import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sendPushNotification } from "./sendPush";
admin.initializeApp();

const getUidFromEmail = async (email: string): Promise<string | null> => {
  const userSnapshot = await admin
    .firestore()
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!userSnapshot.empty) {
    return userSnapshot.docs[0].id;
  }
  return null;
};

const getUserGivenName = async (email: string): Promise<string> => {
  const userSnapshot = await admin
    .firestore()
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!userSnapshot.empty) {
    const userData = userSnapshot.docs[0].data();
    return userData.givenName || email;
  }
  return email;
};

// *******************************************
// Scheduled function: updateScheduledItemsAvailability
// *******************************************
export const updateScheduledItemsAvailability = onSchedule(
  "every 1 minutes",
  async (event) => {
    const now = admin.firestore.Timestamp.now();
    const itemsRef = admin.firestore().collection("items");

    try {
      // Only examine items that have a pending scheduled start update.
      const snapshot = await itemsRef
        .where("needsScheduledStartUpdate", "==", true)
        .get();

      const batch = admin.firestore().batch();
      let notificationsPromises: Promise<void>[] = [];

      // Use a for-of loop to allow awaiting within the loop.
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Verify arrays exist and have at least one element.
        if (
          data.availabilityStartTime &&
          Array.isArray(data.availabilityStartTime) &&
          data.availabilityStartTime.length > 0 &&
          data.scheduledBy &&
          Array.isArray(data.scheduledBy) &&
          data.scheduledBy.length > 0
        ) {
          const firstStartTime = data.availabilityStartTime[0];
          if (firstStartTime.toMillis() <= now.toMillis()) {
            // Remove the head (index 0) from the scheduled start arrays.
            const newAvailabilityStartTime = data.availabilityStartTime.slice(1);
            const newScheduledBy = data.scheduledBy.slice(1);

            // Get the scheduled user at index 0 to add to the inUseBy array.
            const personToAdd = data.scheduledBy[0];
            let newInUseBy = Array.isArray(data.inUseBy) ? [...data.inUseBy] : [];

            if (!newInUseBy.includes(personToAdd)) {
              newInUseBy.push(personToAdd);
            }

            // Update the item document.
            batch.update(doc.ref, {
              availability: false,
              inUseBy: newInUseBy,
              availabilityStartTime: newAvailabilityStartTime,
              scheduledBy: newScheduledBy,
              needsScheduledStartUpdate: false,
              needsScheduledEndUpdate: true,
            });

            // Build notification messages.
            const itemName = data.name || "Unknown Item";
            // Unique message for the reserving person.
            const reservingMessage = `Your reservation for ${itemName} has started.`;
            // Retrieve the givenName for the personToAdd.
            const personGivenName = await getUserGivenName(personToAdd);
            // Use the givenName instead of the email in the common message.
            const commonMessage = `${itemName} reservation started by ${personGivenName}.`;

            // Create a set of recipient emails from createdBy and sharedWith.
            let recipientsSet = new Set<string>();
            if (data.createdBy) {
              recipientsSet.add(data.createdBy);
            }
            if (data.sharedWith && Array.isArray(data.sharedWith)) {
              data.sharedWith.forEach((email: string) => recipientsSet.add(email));
            }

            // For each recipient, look up the uid and update their notifications.
            recipientsSet.forEach((email) => {
              notificationsPromises.push(
                (async () => {
                  const uid = await getUidFromEmail(email);
                  if (uid) {
                    const notifRef = admin
                      .firestore()
                      .collection("notifications")
                      .doc(uid);
                    const notifDoc = await notifRef.get();

                    // Retrieve current arrays or initialize as empty.
                    const notifData = notifDoc.data() || {};
                    const notificationsArray = notifData.notifications || [];
                    const reserveNotificationArray = notifData.reserveNotification || [];
                    const timestampsArray = notifData.timestamps || [];

                    // Use the unique message for the reserving person.
                    const messageToSend =
                      email === personToAdd ? reservingMessage : commonMessage;

                    notificationsArray.push(messageToSend);
                    reserveNotificationArray.push(messageToSend);
                    timestampsArray.push(admin.firestore.Timestamp.now());

                    // Update the notifications document with all arrays.
                    await notifRef.set(
                      {
                        notifications: notificationsArray,
                        reserveNotification: reserveNotificationArray,
                        timestamps: timestampsArray,
                      },
                      { merge: true }
                    );
                  }
                })()
              );
            });
          }
        }
      }

      // Commit the item updates.
      await batch.commit();

      // Wait for all notifications to be sent.
      await Promise.all(notificationsPromises);
      return; // returns undefined
    } catch (error) {
      console.error("Error updating scheduled items:", error);
      throw error;
    }
  }
);


// *******************************************
// Scheduled function: updateItemsAvailability
// *******************************************
interface NotificationInfo {
  itemName: string;
  releasingPerson?: string;
  recipients: Set<string>;
  type: "immediate" | "scheduled";
}
export const updateItemsAvailability = onSchedule(
  "every 1 minutes",
  async (event) => {
    const now = admin.firestore.Timestamp.now();
    const itemsRef = admin.firestore().collection("items");

    try {
      const batch = admin.firestore().batch();
      const notificationsPromises: Promise<void>[] = [];
      const notificationsToSend: NotificationInfo[] = [];

      // -- Process end of immediate reservations --
      const immediateSnapshot = await itemsRef
        .where("needsImmediateUpdate", "==", true)
        .where("availabilityChangeTime", "<=", now)
        .get();

      immediateSnapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Prepare update data.
        const updateData: { [key: string]: any } = {
          availability: true,
          availabilityChangeTime: null,
          needsImmediateUpdate: false,
        };

        // Capture the releasing person from inUseBy.
        const releasingPerson =
          Array.isArray(data.inUseBy) && data.inUseBy.length > 0
            ? data.inUseBy[0]
            : undefined;

        // Clear inUseBy if present.
        if (Array.isArray(data.inUseBy) && data.inUseBy.length > 0) {
          updateData.inUseBy = [];
        }

        batch.update(doc.ref, updateData);

        // Build notification info.
        const itemName = data.name || "Unknown Item";
        const recipientsSet = new Set<string>();
        if (data.createdBy) {
          recipientsSet.add(data.createdBy);
        }
        if (data.sharedWith && Array.isArray(data.sharedWith)) {
          data.sharedWith.forEach((email: string) => recipientsSet.add(email));
        }

        notificationsToSend.push({
          itemName,
          releasingPerson,
          recipients: recipientsSet,
          type: "immediate",
        });
      });

      // -- Process Scheduled End Reservations --
      const scheduledSnapshot = await itemsRef
        .where("needsScheduledEndUpdate", "==", true)
        .where("nextAvailabilityScheduledChangeTime", "<=", now)
        .get();

      scheduledSnapshot.docs.forEach((doc) => {
        const data = doc.data();

        // Remove the head from the availabilityScheduledChangeTime array.
        const newAvailabilityScheduledChangeTime = data.availabilityScheduledChangeTime.slice(1);
        // Set the next scheduled change time if any remain.
        const nextTime =
          data.availabilityScheduledChangeTime.length > 0
            ? data.availabilityScheduledChangeTime[0]
            : null;
        // Determine if a new scheduled update is needed.
        const needs = data.availabilityScheduledChangeTime.length > 0 ? true : false;

        // Capture the releasing person.
        const releasingPerson =
          Array.isArray(data.inUseBy) && data.inUseBy.length > 0
            ? data.inUseBy[0]
            : undefined;

        batch.update(doc.ref, {
          availability: true,
          availabilityScheduledChangeTime: newAvailabilityScheduledChangeTime,
          inUseBy: [],
          nextAvailabilityScheduledChangeTime: nextTime,
          needsScheduledEndUpdate: false,
          needsScheduledStartUpdate: needs,
        });

        // Build notification info.
        const itemName = data.name || "Unknown Item";
        const recipientsSet = new Set<string>();
        if (data.createdBy) {
          recipientsSet.add(data.createdBy);
        }
        if (data.sharedWith && Array.isArray(data.sharedWith)) {
          data.sharedWith.forEach((email: string) => recipientsSet.add(email));
        }

        notificationsToSend.push({
          itemName,
          releasingPerson,
          recipients: recipientsSet,
          type: "scheduled",
        });
      });

      await batch.commit();


      // Process sending notifications for each item.
      
      // For each notification info, build two messages.
      // a unique message for the releasing person and a common message for other recipients.

      // ensure that for each message pushed to notifications,
      // also push a corresponding timestamp into timestamps so that their indexes align.

      for (const notifyInfo of notificationsToSend) {
        const { itemName, releasingPerson, recipients, type } = notifyInfo;
        // Retrieve the givenName for the releasing person.
        const releasingGivenName = releasingPerson
          ? await getUserGivenName(releasingPerson)
          : "someone";

        let uniqueMessage: string;
        let commonMessage: string;
        if (type === "immediate") {
          uniqueMessage = `Your reservation for ${itemName} has ended.`;
          commonMessage = `${itemName} has been released by ${releasingGivenName}.`;
        } else {
          uniqueMessage = `Your scheduled reservation for ${itemName} has ended.`;
          commonMessage = `${itemName} has been released by ${releasingGivenName}.`;
        }

        // For each recipient email, look up their uid and update their notifications.
        recipients.forEach((email) => {
          notificationsPromises.push(
            (async () => {
              const uid = await getUidFromEmail(email);
              if (uid) {
                const notifRef = admin
                  .firestore()
                  .collection("notifications")
                  .doc(uid);
                const notifDoc = await notifRef.get();
                const notifData = notifDoc.data() || {};

                // Retrieve or initialize the notifications arrays.
                const notificationsArray: string[] = notifData.notifications || [];
                const releaseNotificationArray: string[] = notifData.releaseNotification || [];
                const timestampsArray: admin.firestore.Timestamp[] = notifData.timestamps || [];
                // Determine which message to send.
                const messageToSend =
                  email === releasingPerson ? uniqueMessage : commonMessage;
                // Push the notification and its timestamp concurrently
                notificationsArray.push(messageToSend);
                releaseNotificationArray.push(messageToSend);
                timestampsArray.push(admin.firestore.Timestamp.now());
                await notifRef.set(
                  {
                    notifications: notificationsArray,
                    releaseNotification: releaseNotificationArray,
                    timestamps: timestampsArray,
                  },
                  { merge: true }
                );
              }
            })()
          );
        });
      }

      await Promise.all(notificationsPromises);

      return;
    } catch (error) {
      console.error("Error updating items availability:", error);
      throw error;
    }
  }
);


// *******************************************
// Firestore trigger: Send multiple notifications for new notifications array items
// *******************************************
// This function triggers whenever a user's document in the "notifications" collection is updated.
export const notifyOnNewUserNotification = onDocumentUpdated(
  "notifications/{userId}",
  async (event) => {
    // Guard against possible undefined event data.
    if (!event.data) {
      console.error("No event data available");
      return;
    }

    // Get the snapshots before and after the update.
    const beforeSnap = event.data.before;
    const afterSnap = event.data.after;

    // Extract data from the snapshots.
    const beforeData = beforeSnap.data() || {};
    const afterData = afterSnap.data() || {};

    // Retrieve the reserve and release arrays.
    const oldReserveNotification = Array.isArray(beforeData.reserveNotification)
      ? beforeData.reserveNotification
      : [];
    const newReserveNotification = Array.isArray(afterData.reserveNotification)
      ? afterData.reserveNotification
      : [];
    const oldReleaseNotification = Array.isArray(beforeData.releaseNotification)
      ? beforeData.releaseNotification
      : [];
    const newReleaseNotification = Array.isArray(afterData.releaseNotification)
      ? afterData.releaseNotification
      : [];

    // Determine the unique new strings added to each array.
    const uniqueNewReserveNotification = newReserveNotification.filter(
      (item) => !oldReserveNotification.includes(item)
    );
    const uniqueNewReleaseNotification = newReleaseNotification.filter(
      (item) => !oldReleaseNotification.includes(item)
    );

    // Retrieve the FCM device token.
    // In this custom implementation using FCM HTTP v1, the token should be the FCM registration token.
    const fcmToken = afterData.fcmPushToken;
    if (!fcmToken) {
      console.log(`No device token found for user ${event.params.userId}`);
      return;
    }

    // Send push notifications for new reserve notifications.
    if (uniqueNewReserveNotification.length > 0) {
      console.log(
        `User ${event.params.userId} has ${uniqueNewReserveNotification.length} new reserve(s):`,
        uniqueNewReserveNotification
      );

      for (const item of uniqueNewReserveNotification) {
        // Construct payload according to FCM HTTP v1 API.
        const reservePayload = {
          token: fcmToken,
          notification: {
            title: "Item reserved",
            body: item,
          },
          data: { newItem: item, type: "reserve" },
        };

        try {
          const result = await sendPushNotification(reservePayload);
          console.log(
            `Push notification sent for reserve: "${item}". Result:`,
            result
          );
        } catch (error) {
          console.error(
            `Error sending push notification for reserve: "${item}"`,
            error
          );
        }
      }
    } else {
    }

    // Send push notifications for new release notifications.
    if (uniqueNewReleaseNotification.length > 0) {
      console.log(
        `User ${event.params.userId} has ${uniqueNewReleaseNotification.length} new release(s):`,
        uniqueNewReleaseNotification
      );

      for (const item of uniqueNewReleaseNotification) {
        // Construct payload according to FCM HTTP v1 API.
        const releasePayload = {
          token: fcmToken,
          notification: {
            title: "Item released",
            body: item,
          },
          data: { newItem: item, type: "release" },
        };

        try {
          const result = await sendPushNotification(releasePayload);
          console.log(
            `Push notification sent for release: "${item}". Result:`,
            result
          );
        } catch (error) {
          console.error(
            `Error sending push notification for release: "${item}"`,
            error
          );
        }
      }
    } else {
    }
  }
);
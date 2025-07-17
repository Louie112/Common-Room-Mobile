import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  Timestamp,
  query,
  getDocs,
  where,
  runTransaction,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import getGlobalStyles from '@/app/globalStyles';
import { app } from '../../../../configs/firebaseConfig';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

const useUserData = (email) => {
  const [userData, setUserData] = useState({ givenName: false, photoURL: false });
  useEffect(() => {
    const db = getFirestore(app);
    const fetchUserData = async () => {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const data = querySnapshot.docs[0].data();
          setUserData({
            givenName: data.givenName || null,
            photoURL: data.photoURL || null,
          });
        }
      } catch (error) {
        console.error('Error fetching user data for', email, error);
        setUserData({ givenName: email, photoURL: null });
      }
    };
    fetchUserData();
  }, [email]);
  
  return userData;
};

const DisplayName = React.memo(({ email }) => {
  const { givenName } = useUserData(email);
  return (
    <Text>{givenName}</Text>
  )
})

export default function SchedulingReservation() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const isFocused = useIsFocused();

  const [scheduledStartTime, setScheduledStartTime] = useState(
    new Date(Date.now() + 5 * 60 * 1000)
  );
  // Start with scheduled end time 5 minutes in the future
  const [scheduledEndTime, setScheduledEndTime] = useState(
    new Date(Date.now() + 10 * 60 * 1000)
  );

  useEffect(() => {
    const minimumEndTime = new Date(scheduledStartTime.getTime() + 5 * 60 * 1000);
    if (scheduledEndTime < minimumEndTime) {
      setScheduledEndTime(minimumEndTime);
    }
  }, [scheduledStartTime, scheduledEndTime]);

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    if (!itemId) return;
    const db = getFirestore(app);
    const itemDocRef = doc(db, 'items', itemId);
    const unsubscribe = onSnapshot(itemDocRef, (docSnapshot) => {
      if (docSnapshot.exists) {
        setItem(docSnapshot.data());
      } else {
        setItem(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [itemId]);

  // Scheduled start validation:
  const isScheduledStartTimeInvalid =
    scheduledStartTime.getTime() < Date.now() + 4 * 60 * 1000;

  // Scheduled end validation:
  const isScheduledEndTimeInvalid =
    scheduledEndTime.getTime() < scheduledStartTime.getTime() + 4 * 60 * 1000;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = (timestamp instanceof Timestamp) ? timestamp.toDate() : new Date(timestamp);
    const monthDay = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  
    return `${monthDay}, ${time}`;
  };
    
  const getUidFromEmail = async (db, email) => {
    const usersCollection = collection(db, 'users');
    const q = query(usersCollection, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    let uid = null;
    querySnapshot.forEach((docSnapshot) => {
      uid = docSnapshot.id;
    });
    if (!uid) {
      console.error(`No user found for email: ${email}`);
    }
    return uid;
  };
  
  const fetchUserNameValue = async (email) => {
    const db = getFirestore(app);
    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        return userData.givenName;
      } else {
        return email;
      }
    } catch (error) {
      console.error('Error fetching user with email', email, error);
      return email;
    }
  };

  const confirmReserve = async () => {
    setUpdating(true);
    try {
      const authInstance = getAuth(app);
      const currentUser = authInstance.currentUser;
      if (!currentUser) {
        Alert.alert("Error", "No user is logged in");
        setUpdating(false);
        return;
      }
  
      const db = getFirestore(app);
      const itemRef = doc(db, "items", itemId);
  
      let transactionResult;

      transactionResult = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(itemRef);
        if (!docSnap.exists) {
          Alert.alert("Error", "Document does not exist!");
          return null;
        }
        const data = docSnap.data() || {};
    
        const newStart = Timestamp.fromDate(scheduledStartTime);
        const newEnd = Timestamp.fromDate(scheduledEndTime);
        const newStartMs = newStart.toMillis();
        const newEndMs = newEnd.toMillis();
    
        if (newStartMs >= newEndMs) {
          Alert.alert("Error", "Start time must be before end time.");
          return null;
        }
    
        const fiveMinutes = 300000;
    
        // Ensure the new start is at least 5 minutes after the current availabilityChangeTime, if it exists.
        if (!data.availability){
          if (data.availabilityChangeTime) {
            const availChangeMs = data.availabilityChangeTime.toMillis();
            if (newStartMs < availChangeMs + fiveMinutes) {
              Alert.alert(
                "Error",
                "Start time must be at least 5 minutes after current reservation."
              );
              return null;
            }
          }
          if (data.nextAvailabilityScheduledChangeTime) {
            const nextAvailChangeMS = data.nextAvailabilityScheduledChangeTime.toMillis();
            if (newStartMs < nextAvailChangeMS + fiveMinutes) {
              Alert.alert(
                "Error",
                "Start time must be at least 5 minutes after current reservation."
              );
              return null;
            }
          }
        }

    
        let updates = {};
    
        // If needsScheduledEndUpdate is true, insert the new start and end times into their arrays
        // in chronological order but leave nextAvailabilityScheduledChangeTime untouched.
        if (data.needsScheduledEndUpdate) {
          // Create copies of the existing arrays
          let updatedStartArr =
            data.availabilityStartTime && Array.isArray(data.availabilityStartTime)
              ? [...data.availabilityStartTime]
              : [];
          let updatedScheduledBy =
            data.scheduledBy && Array.isArray(data.scheduledBy)
              ? [...data.scheduledBy]
              : [];
          let updatedEndArr =
            data.availabilityScheduledChangeTime && Array.isArray(data.availabilityScheduledChangeTime)
              ? [...data.availabilityScheduledChangeTime]
              : [];
        
          // Append the new start and end times.
          updatedStartArr.push(newStart);
          updatedEndArr.push(newEnd);
        
          // Sort the start times and end times chronologically.
          updatedStartArr.sort((a, b) => a.toMillis() - b.toMillis());
          updatedEndArr.sort((a, b) => a.toMillis() - b.toMillis());
        
          // Determine where the new start was inserted.
          const newIndex = updatedStartArr.findIndex(
            (item) => item.toMillis() === newStartMs
          );
        
          if (newIndex > 0) {
            // Get the end time of the previous interval.
            const previousEndMs = updatedEndArr[newIndex - 1].toMillis();
            // Ensure the new start is at least five minutes after the previous end.
            if (newStartMs < previousEndMs + fiveMinutes) {
              Alert.alert(
                "Error",
                "Scheduled timeslot is too close to the previous reservation; please ensure at least a 5 minute gap."
              );
              return null;
            }
          }
        
          if (newIndex < updatedStartArr.length - 1) {
            // Get the start time of the next interval.
            const nextStartMs = updatedStartArr[newIndex + 1].toMillis();
            // Ensure the new end is at least five minutes before the next interval's start.
            if (newEndMs > nextStartMs - fiveMinutes) {
              Alert.alert(
                "Error",
                "Scheduled timeslot is too close to the next reservation; please ensure at least a 5 minute gap."
              );
              return null;
            }
          }
        
          // ------------------------------------------------
        
          // Insert the user's email into scheduledBy at the same index.
          updatedScheduledBy.splice(newIndex, 0, currentUser.email);
        
          updates = {
            availabilityStartTime: updatedStartArr,
            availabilityScheduledChangeTime: updatedEndArr,
            scheduledBy: updatedScheduledBy,
          };
        } else {
          let intervals = [];
          if (
            data.availabilityStartTime &&
            Array.isArray(data.availabilityStartTime) &&
            data.availabilityStartTime.length > 0
          ) {
            for (let i = 0; i < data.availabilityStartTime.length; i++) {
              let intervalStart = data.availabilityStartTime[i].toMillis();
              let intervalEnd;
              if (i === 0) {
                if (data.nextAvailabilityScheduledChangeTime) {
                  intervalEnd = data.nextAvailabilityScheduledChangeTime.toMillis();
                } else if (
                  data.availabilityScheduledChangeTime &&
                  data.availabilityScheduledChangeTime.length > 0
                ) {
                  intervalEnd = data.availabilityScheduledChangeTime[0].toMillis();
                } else {
                  continue;
                }
              } else {
                const indexShift = data.nextAvailabilityScheduledChangeTime ? 1 : 0;
                if (
                  data.availabilityScheduledChangeTime &&
                  data.availabilityScheduledChangeTime[i - indexShift]
                ) {
                  intervalEnd = data.availabilityScheduledChangeTime[i - indexShift].toMillis();
                } else {
                  continue;
                }
              }
              intervals.push({ start: intervalStart, end: intervalEnd });
            }
          }
        
          intervals.sort((a, b) => a.start - b.start);
          let insertionIndex = null;
          if (intervals.length === 0) {
            insertionIndex = 0;
          } else if (newEndMs <= intervals[0].start - fiveMinutes) {
            insertionIndex = 0;
          } else if (newStartMs >= intervals[intervals.length - 1].end + fiveMinutes) {
            insertionIndex = intervals.length;
          } else {
            for (let i = 1; i < intervals.length; i++) {
              if (
                newStartMs >= intervals[i - 1].end + fiveMinutes &&
                newEndMs <= intervals[i].start - fiveMinutes
              ) {
                insertionIndex = i;
                break;
              }
            }
          }
          if (insertionIndex === null) {
            Alert.alert(
              "Error",
              "Scheduled timeslot conflicts with an existing reservation or does not satisfy the required 5 minute separation."
            );
            return null;
          }
          const newInterval = { start: newStartMs, end: newEndMs };
          const newIntervals = [
            ...intervals.slice(0, insertionIndex),
            newInterval,
            ...intervals.slice(insertionIndex),
          ];
        
          const newAvailabilityStartTimeArr = newIntervals.map((interval) =>
            Timestamp.fromMillis(interval.start)
          );
          const newNextAvailabilityScheduledChangeTime = Timestamp.fromMillis(
            newIntervals[0].end
          );
          const newAvailabilityScheduledChangeTimeArr = newIntervals
            .slice(1)
            .map((interval) => Timestamp.fromMillis(interval.end));
        
          // For scheduledBy, insert the new user's email at the same index as the new start time.
          let existingScheduledBy =
            data.scheduledBy && Array.isArray(data.scheduledBy)
              ? [...data.scheduledBy]
              : [];
          existingScheduledBy.splice(insertionIndex, 0, currentUser.email);
        
          updates = {
            availabilityStartTime: newAvailabilityStartTimeArr,
            nextAvailabilityScheduledChangeTime: newNextAvailabilityScheduledChangeTime,
            availabilityScheduledChangeTime: newAvailabilityScheduledChangeTimeArr,
            scheduledBy: existingScheduledBy,
          };
        }        
    
        // Set the flag if the item is available or if an immediate update applies.
        if (data.availability || data.needsImmediateUpdate) {
          updates.needsScheduledStartUpdate = true;
        }
    
        let recipients = [];
        if (data.createdBy) {
          recipients.push(data.createdBy);
        }
        if (data.sharedWith && Array.isArray(data.sharedWith)) {
          recipients.push(...data.sharedWith);
        }
        recipients = Array.from(new Set(recipients)).filter(
          (email) => email !== currentUser.email
        );
    
        transaction.update(itemRef, updates);
        return { recipients, itemName: data.name || "Unknown Item" };
      });
  
      // If the transaction returned null because of an error condition, exit.
      if (!transactionResult) {
        setUpdating(false);
        return;
      }
  
      const { recipients: notifRecipients, itemName } = transactionResult;
      const givenName = await fetchUserNameValue(currentUser.email);
  
      // Build notification message conditionally based on mode.
      let notifMessage = "";
      notifMessage = `${itemName} scheduled reservation by ${givenName} from ${formatTimestamp(scheduledStartTime)} to ${formatTimestamp(scheduledEndTime)}`;
  
      // Update the notifications document for each recipient
      await Promise.all(
        notifRecipients.map(async (recipientEmail) => {
          const recipientUid = await getUidFromEmail(db, recipientEmail);
          if (recipientUid) {
            const notifRef = doc(db, "notifications", recipientUid);
            await runTransaction(db, async (transaction) => {
              const notifDocSnap = await transaction.get(notifRef);
              const currentNotifications: string[] = notifDocSnap.exists
                ? notifDocSnap.data().notifications || []
                : [];
              const currentReserveNotifications: string[] = notifDocSnap.exists
                ? notifDocSnap.data().reserveNotification || []
                : [];
              const currentTimestamps: Timestamp[] = notifDocSnap.exists
                ? notifDocSnap.data().timestamps || []
                : [];
      
              const newTimestamp = Timestamp.now();
      
              // Append one new notification and one new timestamp
              const newNotifications = [...currentNotifications, notifMessage];
              const newReserveNotifications = [...currentReserveNotifications, notifMessage];
              const newTimestamps = [...currentTimestamps, newTimestamp];
      
              transaction.set(
                notifRef,
                {
                  notifications: newNotifications,
                  reserveNotification: newReserveNotifications,
                  timestamps: newTimestamps,
                },
                { merge: true }
              );
            });
          }
        })
      );           
      router.push({ pathname: '/(inspect)', params: { itemId, fromHome } });
    } catch (error) {
      Alert.alert("Error", error.message);
      console.error("Error updating availability:", error);
    }
    setUpdating(false);
  };
  
  const handleConfirm = () => {
    if (isScheduledStartTimeInvalid) {
      Alert.alert("Invalid Time", "Please select a start time that is at least 5 minutes from now.");
      return;
    }
    if (isScheduledEndTimeInvalid) {
      Alert.alert("Invalid Time", "Please select an end time that is at least 5 minutes after the start time.");
      return;
    }
    Alert.alert(
      "Confirm Reservation",
      `Are you sure you want to reserve "${item.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes", onPress: confirmReserve },
      ]
    );
  }; 

  if (loading || updating) {
    return (
      <View
        style={[
          { flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color },
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
          <ActivityIndicator size={'large'} color={globalStyles.mainColor.color} />
      </View>
    );
  }

  if (!item) {
    return <Text style={styles.errorText}>Item not found</Text>;
  }

  const handleCancel = () => {
    router.push({ pathname: '/(inspect)', params: { itemId, fromHome } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity style={styles.backButton} onPress={router.back}>
        <MaterialIcons name="chevron-left" size={35} color={globalStyles.mainColor.color} />
      </TouchableOpacity>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={[{ fontWeight: '600' }, { color: globalStyles.mainColor.color }, { fontSize: 15 }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        showsVerticalScrollIndicator={true}
       >
        <View style={{marginLeft: 20, marginRight: 20}}>
          <Text style={{ fontSize: 35, marginTop: 0, color: globalStyles.BlackOrwhite.color }}>Choose a</Text>
          <Text style={{ fontSize: 35, color: globalStyles.BlackOrwhite.color }}>start and end time</Text>
          <Text style={{ fontSize: 15, marginTop: 10, color: globalStyles.DarkGreyOrLightGrey.color }}>ensure a 5 minute gap between any other reservations for {item.name}</Text>
          <View style={{ marginTop: 20, marginBottom: 20 }}>
            {(item.needsScheduledEndUpdate ||
              item.needsImmediateUpdate ||
              (item.scheduledBy && item.scheduledBy.length > 0)) ? (
              <>
                <View style={[{ flexDirection: "row" }, { alignItems: "center", marginTop: 10 }]}>
                  <MaterialIcons name="bar-chart" size={20} color={globalStyles.BlackOrwhite.color} />
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        fontSize: globalStyles.sectiontitlefontsize.fontSize,
                        marginBottom: 0,
                        color: globalStyles.BlackOrwhite.color
                      },
                    ]}
                  >
                    Current reservations
                  </Text>
                </View>

                {item.needsScheduledEndUpdate && (
                  <View style={styles.reservationContainer}>
                    <View>
                      <Text style={{color: globalStyles.BlackOrwhite.color}}>
                        Currently in use by{" "}
                        {item.inUseBy && item.inUseBy.length > 0 ? (
                          item.inUseBy.map((email, index) => (
                            <React.Fragment key={index}>
                              <DisplayName email={email} />
                              {index !== item.inUseBy.length - 1 && ", "}
                            </React.Fragment>
                          ))
                        ) : (
                          "N/A"
                        )}{" "}
                        until
                      </Text>
                    </View>
                    <Text style={[styles.reservationTime, {color: globalStyles.DarkGreyOrLightGrey.color}]}>
                      {item.availabilityChangeTime
                        ? formatTimestamp(item.availabilityChangeTime)
                        : formatTimestamp(item.nextAvailabilityScheduledChangeTime)}
                    </Text>
                  </View>
                )}

                {item.needsImmediateUpdate && (
                  <View style={styles.reservationContainer}>
                    <View>
                      <Text style={{color: globalStyles.BlackOrwhite.color}}>
                        Currently in use by{" "}
                        {item.inUseBy && item.inUseBy.length > 0 ? (
                          item.inUseBy.map((email, index) => (
                            <React.Fragment key={index}>
                              <DisplayName email={email} />
                              {index !== item.inUseBy.length - 1 && ", "}
                            </React.Fragment>
                          ))
                        ) : (
                          "N/A"
                        )}{" "}
                        until
                      </Text>
                    </View>
                    <Text style={[styles.reservationTime, {color: globalStyles.DarkGreyOrLightGrey.color}]}>
                      {item.availabilityChangeTime
                        ? formatTimestamp(item.availabilityChangeTime)
                        : formatTimestamp(item.nextAvailabilityScheduledChangeTime)}
                    </Text>
                  </View>
                )}

                {item.scheduledBy && item.scheduledBy.length > 0 &&
                  item.scheduledBy.map((user, index) => {
                    // For the first reservation, the end time comes from nextAvailabilityScheduledChangeTime.
                    // For subsequent intervals, the interval end comes from availabilityScheduledChangeTime[index - 1]
                    const startTime = item.availabilityStartTime
                      ? item.availabilityStartTime[index]
                      : null;
                    const endTime = item.needsScheduledEndUpdate
                      ? item.availabilityScheduledChangeTime
                        ? item.availabilityScheduledChangeTime[index]
                        : null
                      : index === 0
                      ? item.nextAvailabilityScheduledChangeTime
                      : item.availabilityScheduledChangeTime
                      ? item.availabilityScheduledChangeTime[index - 1]
                      : null;

                    const formatTimestamp = (timestamp) => {
                      if (!timestamp) return "N/A";
                      const date = (timestamp instanceof Timestamp) ? timestamp.toDate() : new Date(timestamp);
                      const monthDay = date.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                      });
                      const time = date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                    
                      return `${monthDay}, ${time}`;
                    };   
                    return (
                      <View key={index} style={styles.reservationContainer}>
                        <Text style={{color: globalStyles.BlackOrwhite.color}}>
                          <DisplayName email={user} />'s reservation
                        </Text>
                        <Text style={[styles.reservationTime, {color: globalStyles.DarkGreyOrLightGrey.color}]}>
                          From: {formatTimestamp(startTime)}
                          {"\n"}To: {formatTimestamp(endTime)}
                        </Text>
                      </View>
                    );
                  })
                }
              </>
            ) : (
              <Text style={{color: globalStyles.BlackOrwhite.color}}>Currently no reservations scheduled</Text>
            )}
          </View>
        </View>

        <View style={{marginBottom: 150}}>
          <View style={{marginTop: 20}}>
            <View>
              <Text style={[styles.label, {color: globalStyles.BlackOrwhite.color}]}>
                Select start time
              </Text>
              <View style={{alignItems: 'center', marginHorizontal: 15, borderRadius: 25, backgroundColor: globalStyles.LightGreyOrDarkGrey.color}}>
                <DatePicker
                  date={scheduledStartTime}
                  onDateChange={(newDate) => setScheduledStartTime(newDate)}
                  mode="datetime"
                  locale="en"
                  style={{ transform: [{ scaleX: 1.25 }, { scaleY: 1.25 }], marginVertical: 25 }}
                  minimumDate={new Date(Date.now())}
                />
              </View>
              <Text style={[styles.errorMessage, {opacity: isScheduledStartTimeInvalid ? 1 : 0, marginTop: 10}]}>
                Start time must be at least 5 minutes from now
              </Text>
            </View>
            <View style={{marginTop: 20, marginBottom: 40}}>
              <Text style={[styles.label, {marginTop: 0, color: globalStyles.BlackOrwhite.color}]}>
                Select end time
              </Text>
              <View style={{alignItems: 'center', marginHorizontal: 15, borderRadius: 25, backgroundColor: globalStyles.LightGreyOrDarkGrey.color}}>
                <DatePicker
                  date={scheduledEndTime}
                  onDateChange={(newDate) => setScheduledEndTime(newDate)}
                  mode="datetime"
                  locale="en"
                  style={{ transform: [{ scaleX: 1.25 }, { scaleY: 1.25 }], marginVertical: 25 }}
                  minimumDate={new Date(Date.now())}
                />
              </View>
              <Text style={[styles.errorMessage, {opacity: isScheduledEndTimeInvalid ? 1 : 0, marginTop: 20}]}>
                End time must be at least 5 minutes after start time
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          height: 100,
          backgroundColor: globalStyles.mainBackgroundColor.color,
          justifyContent: 'center',
          alignItems: 'center',
          borderTopColor: globalStyles.LightGreyOrDarkGrey.color,
          borderTopWidth: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <TouchableOpacity
          style={{
            padding: 15,
            backgroundColor: globalStyles.mainColor.color,
            borderRadius: 100,
            width: '85%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={handleConfirm}
          disabled={updating || isScheduledStartTimeInvalid || isScheduledEndTimeInvalid}
        >
          <Text style={[styles.buttonText, { color: "white" }]}>
            Complete reservation
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  arrowContainer: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    borderRadius: 25,
  },
  backButton: {
    position: 'absolute',
    top: 35,
    left: 10,
    zIndex: 100,
  },
  reservationTime: {
    fontSize: 14,
    lineHeight: 20,
  },
  reservationContainer: {
    backgroundColor: "transparent",
    padding: 20,
    borderWidth: 1,
    borderColor: 'grey',
    borderRadius: 20,
    marginTop: 15,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 30,
    paddingVertical: 20,
    marginTop: 25,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: 19, marginLeft: 15, color: "white" },
  container: { flex: 1, padding: 20 },
  accordionSection: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
  },
  accordionHeader: { padding: 15, backgroundColor: "#f1f1f1" },
  accordionTitle: { fontSize: 16, fontWeight: "600" },
  accordionContent: { backgroundColor: "#fff" },
  label: { fontSize: 15, marginVertical: 10, marginLeft: 20, marginTop: 20, marginBottom: 10, fontWeight: 600 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  checkboxLabel: { marginLeft: 10, fontSize: 15 },
  errorMessage: { color: "red", textAlign: "center", marginTop: 5 },
  button: { width: "100%", borderRadius: 50, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 18, color: "red" },
  sectionTitle: {
    textAlign: 'left',
    marginLeft: 5,
  },
});



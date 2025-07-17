import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  Timestamp,
  arrayUnion,
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
  const [userData, setUserData] = useState({ givenName: false, photoURL: false});
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

export default function ReservingImmediately() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();
  const isFocused = useIsFocused();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [immediateWithoutExpiration, setImmediateWithoutExpiration] = useState(false);
  const [immediateExpirationDate, setImmediateExpirationDate] = useState(
    new Date(Date.now() + 5 * 60 * 1000)
  );

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

  // Immediate reservation validation:
  const isImmediateTimeInvalid =
    !immediateWithoutExpiration &&
    immediateExpirationDate.getTime() < Date.now() + 4 * 60 * 1000;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
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
        const data = docSnap.data();

        if (!data.availability) {
          Alert.alert("Error", "Item is currently unavailable for immediate reservation.");
          return null;
        }

        const changeTime = immediateWithoutExpiration
          ? null
          : Timestamp.fromDate(immediateExpirationDate);

        if (data.availabilityStartTime && data.availabilityStartTime.length > 0) {
          const firstScheduledStart = data.availabilityStartTime[0];
          // Allow immediate reservation if the expiration time is at least 5 minutes before the next scheduled start
          if (!changeTime || changeTime.toMillis() > firstScheduledStart.toMillis() - 300000) {
            Alert.alert(
              "Error",
              "There must be an expiration time at least 5 minutes before the next scheduled reservation starts."
            );
            return null;
          }
        }            

        // Set the reservation updates.
        const updates = {
          availability: false,
          inUseBy: arrayUnion(currentUser.email),
        };

        if (changeTime !== null) {
          updates.availabilityChangeTime = changeTime;
          updates.needsImmediateUpdate = true;
        }

        // Gather notification recipients
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
  
      // If the transaction returned null because of an error condition, exit
      if (!transactionResult) {
        setUpdating(false);
        return;
      }
  
      const { recipients: notifRecipients, itemName } = transactionResult;
      const givenName = await fetchUserNameValue(currentUser.email);
  
      // Build notification message conditionally based on mode.
      let notifMessage = "";
      if (immediateWithoutExpiration) {
        notifMessage = `${itemName} reserved immediately without expiration by ${givenName}`;
      } else {
        notifMessage = `${itemName} reserved immediately by ${givenName} until ${formatTimestamp(immediateExpirationDate)}`;
      }
  
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
    if (!immediateWithoutExpiration && isImmediateTimeInvalid) {
      Alert.alert("Invalid Time", "Please select an expiration time that is at least 5 minutes from now.");
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

  const handleCancel = () => {
    router.push({ pathname: '/(inspect)', params: { itemId, fromHome } });
  }

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
      <ScrollView showsVerticalScrollIndicator={true}>
        <View style={{marginLeft: 20, marginRight: 20}}>
          <Text style={{ fontSize: 35, marginTop: 0, color: globalStyles.BlackOrwhite.color }}>Choose an</Text>
          <Text style={{ fontSize: 35, color: globalStyles.BlackOrwhite.color }}>end time</Text>
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

                    const formatTimestamp = (ts) =>
                      ts ? new Date(ts.toMillis()).toLocaleString() : "N/A";

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
                  })}
              </>
            ) : (
              <Text style={{color: globalStyles.DarkGreyOrLightGrey.color}}>Currently no reservations scheduled</Text>
            )}
          </View>
        </View>
        <View style={{marginBottom: 150}}>
          <View style={[{marginTop: 10}]}>
            <Text style={[styles.label, {color: globalStyles.BlackOrwhite.color}]}>
              Select end time
            </Text>
            <View style={{opacity: !immediateWithoutExpiration ? 1 : 0.4, alignItems: 'center', marginTop: 10, marginHorizontal: 15, borderRadius: 25, backgroundColor: globalStyles.LightGreyOrDarkGrey.color}} pointerEvents={!immediateWithoutExpiration ? "auto" : "none"}>
              <DatePicker
                date={immediateExpirationDate}
                onDateChange={(newDate) => setImmediateExpirationDate(newDate)}
                mode="datetime"
                locale="en"
                style={{ transform: [{ scaleX: 1.25 }, { scaleY: 1.25 }], marginVertical: 25 }}
                minimumDate={new Date(Date.now())}
              />
            </View>
            <View style={[{ flexDirection: "row", alignItems: "center", marginBottom: 10 }, {marginTop: 20, marginLeft: 20}]}>
              <Switch
                value={immediateWithoutExpiration}
                onValueChange={setImmediateWithoutExpiration}
                trackColor={{false: globalStyles.LightGreyOrDarkGrey.color, true: globalStyles.brightMainColor.color}}
                thumbColor={globalStyles.mainColor.color}
              />
              <Text style={[styles.checkboxLabel, {color: globalStyles.BlackOrwhite.color}]}>Reserve without expiration date</Text>
            </View>
            {immediateWithoutExpiration ? (
              <Text style={[styles.errorMessage, {opacity: immediateWithoutExpiration ? 1 : 0}]}>
                No expiration date will block other reservations
              </Text>
            ) : (
              <Text style={[styles.errorMessage, {opacity: isImmediateTimeInvalid ? 1 : 0}]}>
                End time must be at least 5 minutes away
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
      <View
        style={{
          height: 100,
          justifyContent: 'center',
          alignItems: 'center',
          borderTopColor: globalStyles.LightGreyOrDarkGrey.color,
          backgroundColor: globalStyles.mainBackgroundColor.color,
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
            backgroundColor: isImmediateTimeInvalid ? globalStyles.LightGreyOrDarkGrey.color : globalStyles.mainColor.color,
            borderRadius: 100,
            width: '85%',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={handleConfirm}
          disabled={updating || (!immediateWithoutExpiration && isImmediateTimeInvalid)}
        >
          <Text style={[styles.buttonText, { color: "white" }]}>
            Confirm reserve
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    textAlign: 'left',
    marginLeft: 5,
  },
  label: { fontSize: 15, marginVertical: 10, marginLeft: 20, marginTop: 20, marginBottom: 0, fontWeight: 600 },
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
  accordionHeader: { padding: 15, backgroundColor: "#f1f1f1" },
  accordionTitle: { fontSize: 16, fontWeight: "600" },
  datePicker: { },
  checkboxLabel: { marginLeft: 10, fontSize: 15 },
  errorMessage: { color: "red", textAlign: "center", marginBottom: 20, marginTop: 0 },
  button: { width: "100%", borderRadius: 50, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "600" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 18, color: "red" },
});



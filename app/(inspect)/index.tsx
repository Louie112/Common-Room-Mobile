import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Alert,
  TouchableOpacity,
  BackHandler,
  Image,
  Animated
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import getGlobalStyles from '../globalStyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons  from '@expo/vector-icons/MaterialIcons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  updateDoc,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
  getDoc,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { app } from '../../configs/firebaseConfig';

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

const DisplayPhoto = React.memo(({ email }) => {
  const { photoURL } = useUserData(email);
  return photoURL ? (
    <Image source={{ uri: photoURL }} style={styles.friendImage} />
  ) : (
    <MaterialIcons name="account-circle" size={40} color="grey" style={{marginRight: 0}}/>
  );
})

const DisplayName = React.memo(({ email }) => {
  const { givenName } = useUserData(email);
  return (
    <Text>{givenName}</Text>
  )
})

export default function Inspect() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const { itemId, fromHome } = useLocalSearchParams();

  const [itemDetails, setItemDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatorEmail, setCreatorEmail] = useState(null);
  const authInstance = getAuth(app);
  const currentUser = authInstance.currentUser;
  const [userFavorites, setUserFavorites] = useState([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [welcome5ModalVisible, setWelcome5ModalVisible] = useState(true);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  const isFocused = useIsFocused();

  const handleBack = useCallback(() => {
    if (fromHome) {
      router.replace('/(tabs)/(home)');
    } else {
      router.replace('/(tabs)/(manage)');
    }
  }, [fromHome, router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );
      return () => subscription.remove();
    }, [handleBack])
  );

  useEffect(() => {
    if (!isFocused || !itemId || !currentUser) {
      return;
    }
  
    setUser(currentUser);
    const db = getFirestore(app);
    let unsubscribeCreator = null;
    const welcomeDocRef = doc(db, 'users', currentUser.uid)

    async function fetchWelcome5() {
      try {
        const snap = await getDoc(welcomeDocRef)
        if (snap.exists) {
          // grab only the boolean flag
          const flag = snap.get('welcome5')
          setWelcome5ModalVisible(flag ?? false)
        } else {
          setError('User document not found')
        }
      } catch (err) {
        console.error('Error fetching welcome5:', err)
        setError('Failed to load welcome flag')
      } finally {
        setLoading(false)
      }
    }
    fetchWelcome5()
  
    // Real-time listener for item details
    const itemDocRef = doc(db, 'items', itemId);
    
    const unsubscribeItem = onSnapshot(
      itemDocRef,
      (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const itemData = docSnapshot.data();
          setItemDetails(itemData);
          setError(null);
  
          // secondary realtime listener for the creator's email
          const userId = itemData.userId;
          if (userId) {
            const userDocRef = doc(db, 'users', userId);
            // unsubscribe any previous creator listener
            if (unsubscribeCreator) {
              unsubscribeCreator();
            }
            unsubscribeCreator = onSnapshot(
              userDocRef,
              (userDocSnapshot) => {
                if (userDocSnapshot && userDocSnapshot.exists) {
                  setCreatorEmail(userDocSnapshot.data().email);
                }
              },
              (error) => {
                console.error("Error in creator listener:", error);
              }
            );
          }
        } else {
          setItemDetails(null);
          setError(`Item ${itemId} not found.`);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error in item snapshot:", error);
        setError("An error occurred while fetching item details.");
        setLoading(false);
      }
    );
  
    // Real-time listener for user favorites
    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribeFavorites = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const favorites = docSnapshot.data().favorites || [];
          setUserFavorites(favorites);
          setIsFavorited(favorites.includes(itemId));
        } else {
          setUserFavorites([]);
          setIsFavorited(false);
        }
        setFavoritesLoading(false);
      },
      (error) => {
        console.error("Error in favorites snapshot:", error);
      }
    );
  
    // Cleanup all listeners when the page is unfocused or unmounted
    return () => {
      unsubscribeItem();
      unsubscribeFavorites();
      if (unsubscribeCreator) {
        unsubscribeCreator();
      }
    };
  }, [isFocused, itemId, currentUser]);

  const handleWelcome5Close = async () => {
    setWelcome5ModalVisible(false);
    const db = getFirestore();
    const userDocRef = doc(db, "users", user.uid);
    try {
      await updateDoc(userDocRef, { welcome5: false });
    } catch (error) {
      console.error("Error updating the welcome field:", error);
    }
  }

  const handleReserve = () => {
    router.push({ pathname: '/(inspect)/reserve', params: { itemId, fromHome } });
  };

  const handleRelinquish = () => {
    Alert.alert('Confirm Relinquish', 'Are you sure you want to relinquish this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: relinquishItem },
    ]);
  };

  const handleToggleFavorite = async () => {
    if (!itemId || !currentUser) return;
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', currentUser.uid);
      if (isFavorited) {
        await updateDoc(userRef, {
          favorites: arrayRemove(itemId),
        });
      } else {
        await updateDoc(userRef, {
          favorites: arrayUnion(itemId),
        });
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
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

  /**
   * This function retrieves the uid for each email in itemDetails.createdBy and itemDetails.sharedWith,
   * then updates their notifications document in the "notifications" collection by pushing a message
   * to both notifications and releaseNotification arrays. The releaser’s message is unique.
   */
  const sendRelinquishNotifications = async (db) => {
    if (!itemDetails || !currentUser) return;
    const givenName = await fetchUserNameValue(currentUser.email);
    const defaultMessage = `${itemDetails.name} has been relinquished by ${givenName}.`;
    const releaserMessage = `You have relinquished item ${itemDetails.name}.`;

    // Combine emails from createdBy and sharedWith.
    let emails = [];
    if (itemDetails.createdBy && Array.isArray(itemDetails.createdBy)) {
      emails = emails.concat(itemDetails.createdBy);
    }
    if (itemDetails.sharedWith && Array.isArray(itemDetails.sharedWith)) {
      emails = emails.concat(itemDetails.sharedWith);
    }
    // Remove duplicate emails.
    emails = [...new Set(emails)];

    // For each email, retrieve the corresponding uid from the "users" collection and update notifications.
    for (const email of emails) {
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      );
      const userSnapshot = await getDocs(userQuery);
      // Loop through any matching documents
      for (const userDoc of userSnapshot.docs) {
        const uid = userDoc.id;
        // Choose the releaser’s unique message if this email matches the current user.
        const message = email === currentUser.email ? releaserMessage : defaultMessage;
        const notifRef = doc(db, "notifications", uid);
        // Append the message to both notifications arrays.
        await updateDoc(notifRef, {
          notifications: arrayUnion(message),
          releaseNotification: arrayUnion(message),
          timestamps: arrayUnion(Timestamp.now())
        });
      }
    }
  };

  const relinquishItem = async () => {
    if (!itemId || !itemDetails || !currentUser) return;

    try {
      const db = getFirestore(app);
      const itemRef = doc(db, "items", itemId);

      // 1. IF an immediate update is needed:
      //    • Set availability to true.
      //    • Clear the availabilityChangeTime.
      //    • Set needsImmediateUpdate to false.
      //    • Empty inUseBy array.
      if (itemDetails.needsImmediateUpdate) {
        await updateDoc(itemRef, {
          availability: true,
          availabilityChangeTime: null,
          needsImmediateUpdate: false,
          inUseBy: [],
        });
        await sendRelinquishNotifications(db);
        return;
      }

      // 2. IF a scheduled end update is needed:
      if (itemDetails.needsScheduledEndUpdate) {
        // Remove the first scheduled change time.
        const newScheduledTimes = itemDetails.availabilityScheduledChangeTime.slice(1);
        // Get the next scheduled change time if available.
        const nextTime =
          itemDetails.availabilityScheduledChangeTime.length > 0
            ? itemDetails.availabilityScheduledChangeTime[0]
            : null;
        const needsFurtherUpdate = itemDetails.availabilityScheduledChangeTime.length > 0;

        await updateDoc(itemRef, {
          availability: true,
          availabilityScheduledChangeTime: newScheduledTimes,
          nextAvailabilityScheduledChangeTime: nextTime,
          needsScheduledEndUpdate: false,
          needsScheduledStartUpdate: needsFurtherUpdate,
          inUseBy: [],
        });
        await sendRelinquishNotifications(db);
        return;
      }

      // 3. Otherwise, simply update availability to true and clear the inUseBy array.
      await updateDoc(itemRef, {
        availability: true,
        inUseBy: [],
      });
      await sendRelinquishNotifications(db);
    } catch (error) {
      console.error("Error relinquishing item:", error);
    }
  };
  
  const handleEditItem = () => {
    router.push({ pathname: '/(inspect)/editItem', params: { itemId, fromHome } });
  };

  const handleManageUsers = () => {
    router.push({ pathname: '/(inspect)/manageUsers', params: { itemId, fromHome } });
  };

  const handleViewUsers = () => {
    router.push({ pathname: '/(inspect)/viewUsers', params: { itemId } });
  };

  const handlePress = (userEmail) => {
    router.push({
      pathname: '/(profileInspect)',
      params: { userEmail }
    });
  };

  const cancelReservation = (index) => {
    Alert.alert(
      "Confirm Cancellation",
      "Are you sure you want to cancel this reservation?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: async () => {
            if (!itemId || !itemDetails) return;

            try {
              // Clone the arrays so as not to directly mutate the original data.
              const newScheduledBy = [...(itemDetails.scheduledBy || [])];
              const newAvailabilityStartTime = [
                ...(itemDetails.availabilityStartTime || []),
              ];
              const newAvailabilityScheduledChangeTime = [
                ...(itemDetails.availabilityScheduledChangeTime || []),
              ];

              // Prepare the updated nextAvailabilityScheduledChangeTime.
              let newNextAvailabilityScheduledChangeTime =
                itemDetails.nextAvailabilityScheduledChangeTime;

              if (index === 0) {
                // For the first reservation, remove the first element from the schedule.
                newNextAvailabilityScheduledChangeTime =
                  newAvailabilityScheduledChangeTime.length > 0
                    ? newAvailabilityScheduledChangeTime.shift()
                    : null;
              } else if (index > 0) {
                // For subsequent reservations, remove the matching scheduled end time.
                if (index - 1 < newAvailabilityScheduledChangeTime.length) {
                  newAvailabilityScheduledChangeTime.splice(index - 1, 1);
                }
              }

              // Remove the canceled reservation from scheduledBy and availabilityStartTime arrays.
              if (index < newScheduledBy.length) {
                newScheduledBy.splice(index, 1);
              }
              if (index < newAvailabilityStartTime.length) {
                newAvailabilityStartTime.splice(index, 1);
              }

              // Set needsScheduledStartUpdate to false if there are no more reservations.
              const newNeedsScheduledStartUpdate =
                newAvailabilityStartTime.length > 0;

              // Update the item document.
              const db = getFirestore(app);
              const itemRef = doc(db, "items", itemId);

              await updateDoc(itemRef, {
                nextAvailabilityScheduledChangeTime:
                  newNextAvailabilityScheduledChangeTime,
                availabilityScheduledChangeTime:
                  newAvailabilityScheduledChangeTime,
                availabilityStartTime: newAvailabilityStartTime,
                scheduledBy: newScheduledBy,
                needsScheduledStartUpdate: newNeedsScheduledStartUpdate,
              });

              // After updating the item document, send out notifications to users.
              await sendCancellationNotifications(db);
            } catch (error) {
              console.error(`Error cancelling reservation at index ${index}:`, error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Sends cancellation notifications to all users related to the item.
   * It retrieves the uid for each email in itemDetails.createdBy and itemDetails.sharedWith
   * and updates their notifications document (in the "notifications" collection) by
   * adding a message to both notifications[] and releaseNotification[]. A unique message is used
   * for the person canceling (currentUser).
   */
  const sendCancellationNotifications = async (db) => {
    if (!itemDetails || !currentUser) {
      console.error('Missing itemId, itemDetails, or currentUser for deletion.');
      return;
    }
    const defaultMessage = `Reservation for item ${itemDetails.name} has been canceled.`;
  
    // Combine emails from createdBy and sharedWith.
    let emails = [];
    if (itemDetails.createdBy && Array.isArray(itemDetails.createdBy)) {
      emails = emails.concat(itemDetails.createdBy);
    }
    if (itemDetails.sharedWith && Array.isArray(itemDetails.sharedWith)) {
      emails = emails.concat(itemDetails.sharedWith);
    }
    // Remove duplicate emails.
    emails = [...new Set(emails)];
  
    // Update notifications for each email except the canceller.
    for (const email of emails) {
      // Skip notifying the user who cancelled the reservation.
      if (email === currentUser.email) continue;
  
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      );
      const userSnapshot = await getDocs(userQuery);
      for (const userDoc of userSnapshot.docs) {
        const uid = userDoc.id;
        const notifRef = doc(db, "notifications", uid);
        await updateDoc(notifRef, {
          notifications: arrayUnion(defaultMessage),
          releaseNotification: arrayUnion(defaultMessage),
          timestamps: arrayUnion(Timestamp.now())
        });
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: globalStyles.mainBackgroundColor.color }]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!itemDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  const { name: itemName, availability, inUseBy = [], userId, needsScheduledEndUpdate, availabilityChangeTime, scheduledBy = [], nextAvailabilityScheduledChangeTime, availabilityScheduledChangeTime = [], availabilityStartTime = [], photoURL} = itemDetails;

  const isInUseByCurrentUser = inUseBy.includes(currentUser.email);
  const hasNoExpiration =
  itemDetails.availability === false &&
  itemDetails.availabilityChangeTime === null &&
  itemDetails.nextAvailabilityScheduledChangeTime === null;
  const isCreatedByCurrentUser = userId === currentUser.uid;

  const textOpacity = scrollY.interpolate({
    inputRange: [photoURL ? 220 : 90, photoURL ? 280 : 150],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });  
  
  const blackIconOpacity = scrollY.interpolate({
    inputRange: [photoURL ? 220 : 90, photoURL ? 280 : 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const greenIconOpacity = scrollY.interpolate({
    inputRange: [photoURL ? 220 : 90, photoURL ? 280 : 150],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.flexContainer, { backgroundColor: globalStyles.mainBackgroundColor.color }]}>
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={'transparent'}
      />
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <View style={{ width: 35, height: 35 }}>
          <Animated.View
            style={[
              { position: 'absolute' },
              { opacity: blackIconOpacity }
            ]}
          >
            <MaterialIcons name="chevron-left" size={35} color={globalStyles.BlackOrwhite.color} />
          </Animated.View>
          <Animated.View
            style={[
              { position: 'absolute' },
              { opacity: greenIconOpacity }
            ]}
          >
            <MaterialIcons name="chevron-left" size={35} color={globalStyles.mainColor.color} />
          </Animated.View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleToggleFavorite} style={styles.heartIcon}>
        <Ionicons
          name={isFavorited ? 'heart' : 'heart-outline'}
          size={30}
          color={globalStyles.mainColor.color}
        />
      </TouchableOpacity>
      <Animated.View style={{backgroundColor: globalStyles.mainBackgroundColor.color, width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10, height: 85, elevation: 3, opacity: textOpacity}}>
        <Text style={{fontSize: 25, marginLeft: 45, marginTop: 33, marginRight: 60, color: globalStyles.BlackOrwhite.color}} numberOfLines={1} ellipsizeMode='tail'>{itemName}</Text>
      </Animated.View>
      <Animated.ScrollView
        contentContainerStyle={[styles.container,{backgroundColor: globalStyles.mainBackgroundColor.color}, {padding: 0}]}
        showsVerticalScrollIndicator={true}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={1} // Ensures 60fps
      >
        {photoURL && (
          <Image source={{uri: photoURL}} style={[{width: '100%'}, {height: 200}, {resizeMode: 'cover'}]}/>
        )}
        <View style={styles.header}>
          <Text style={[styles.title, { marginTop: photoURL ? 20 : 100 }, {marginHorizontal: 20, color: globalStyles.BlackOrwhite.color}]}>
            {itemName}
          </Text>
        </View>
  
        <Text
          style={{
            fontSize: 15,
            color: globalStyles.DarkGreyOrLightGrey.color,
            marginTop: 10,
            marginBottom: 30,
            marginLeft: 20,
          }}
        >
          Current status  - {availability ? ' Available ' : ' Unavailable '}
        </Text>

        <View style={[{flexDirection:'row'}, {alignItems:'center'}, {marginLeft: 20}]}>
          {hasNoExpiration ? (
            <TouchableOpacity style={[styles.button, { backgroundColor: 'grey'}, {width: 150}]}>
              <Text style={[styles.buttonText, { color: 'white' }]}>Cannot reserve</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, { backgroundColor: globalStyles.mainColor.color}, {width: 130}]} onPress={handleReserve}>
              <Text style={[styles.buttonText, { color: 'white' }]}>Reserve</Text>
            </TouchableOpacity>
          )}
          {isInUseByCurrentUser && (
            <TouchableOpacity style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: globalStyles.mainColor.color}, {width: 130}, {marginLeft: 15}]} onPress={handleRelinquish}>
              <Text style={[styles.buttonText, { color: globalStyles.mainColor.color }]}>Relinquish</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[{borderTopWidth: 1}, {borderColor: globalStyles.LightGreyOrDarkGrey.color}, {marginTop: 40}]}>
          <Text style={[{fontSize:25}, {marginBottom: 50}, {marginTop: 20}, {marginLeft: 20, color: globalStyles.BlackOrwhite.color}]}>Usage</Text>
          <View style={[{marginLeft: 20}, {marginRight: 20}]}>
            <View style={[{flexDirection: 'row'}, {alignItems: 'center'}]}>
              <MaterialIcons
                name="bar-chart"
                size={20}
                color={globalStyles.BlackOrwhite.color}
              />
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
                Current users
              </Text>
            </View>

            {inUseBy.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.verticalScrollView}
              >
                {inUseBy.map((otherUser, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handlePress(otherUser)}
                    style={styles.rowContainer}
                    disabled={isInUseByCurrentUser}
                  >
                    <DisplayPhoto email={otherUser} />
                    <View style={{flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', marginTop: 0}}>
                      <Text style={[styles.nameText, { fontWeight: 600 , color: globalStyles.BlackOrwhite.color}]}>
                        {isInUseByCurrentUser ? (
                          <Text><DisplayName email={otherUser} /> (You)</Text>
                        ) : (
                          <DisplayName email={otherUser} />
                        )}
                      </Text>
                      <Text style={[styles.nameText, {color: globalStyles.DarkGreyOrLightGrey.color}]}>
                        {availabilityChangeTime ? (
                          "using until " +
                          availabilityChangeTime
                            .toDate()
                            .toLocaleString("en-US", {
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                        ) : nextAvailabilityScheduledChangeTime ? (
                          "using until " +
                          nextAvailabilityScheduledChangeTime
                            .toDate()
                            .toLocaleString("en-US", {
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                        ) : (
                          "using until manual release"
                        )}f
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noSharedWithText}>
                Item is not in use by anyone
              </Text>
            )}
          </View>

          <View style={[{marginLeft: 20}, {marginBottom: 50}, {marginRight: 20}, {marginTop: 40}]}>
            <View style={[{flexDirection: 'row'}, {alignItems: 'center'}]}>
              <MaterialIcons
                name="schedule"
                size={20}
                color={globalStyles.BlackOrwhite.color}
              />
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    fontSize: globalStyles.sectiontitlefontsize.fontSize,
                    marginBottom: 0, color: globalStyles.BlackOrwhite.color
                  },
                ]}
              >
                Schedule
              </Text>
            </View>

            {scheduledBy && scheduledBy.length > 0 ? (
              scheduledBy.map((user, index) => {
                // For the first reservation, the end time comes from nextAvailabilityScheduledChangeTime.
                // For subsequent intervals, the interval end comes from availabilityScheduledChangeTime[index - 1]
                const startTime = availabilityStartTime ? availabilityStartTime[index] : null;
                const endTime = needsScheduledEndUpdate
                ? (availabilityScheduledChangeTime ? availabilityScheduledChangeTime[index] : null)
                : (index === 0 
                    ? nextAvailabilityScheduledChangeTime 
                    : (availabilityScheduledChangeTime ? availabilityScheduledChangeTime[index - 1] : null));
              
                    
                const formatTimestamp = (ts) => {
                  if (!ts) return "N/A";
                  const date = new Date(ts.toMillis());
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

                const isCurrentUserReservation = currentUser.email === user;

                return (
                  <View key={index} style={[styles.reservationContainer, {backgroundColor: 'transparent'}]}>
                    <Text style={{color: globalStyles.BlackOrwhite.color, fontWeight: 600, fontSize: 15, marginBottom: 10}}>
                      <DisplayName email={user} />
                    </Text>
                    <Text style={[styles.reservationTime, {color: globalStyles.DarkGreyOrLightGrey.color, fontSize: 13, marginBottom: 5}]}>
                      Start time: {formatTimestamp(startTime)}{"\n"}End time: {formatTimestamp(endTime)}
                    </Text>
                    {isCurrentUserReservation && (
                      <TouchableOpacity style={[{flexDirection: 'row'}, {justifyContent: 'flex-start'}, {backgroundColor: 'transparent'}, {width: 50}, {paddingVertical: 5}, {borderRadius: 10}]} onPress={() => cancelReservation(index)}>
                        <Text style={[{color: 'red', fontSize: 15}]}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={styles.noSharedWithText}>No reservations scheduled</Text>
            )}
          </View>
        </View>
        {isCreatedByCurrentUser ? (
          <View style={[{borderTopWidth: 1}, {borderColor: globalStyles.LightGreyOrDarkGrey.color}, {marginBottom: 120}]}>
            <Text style={[{fontSize:25}, {marginBottom: 25}, {marginTop: 20}, {marginLeft: 20, color: globalStyles.BlackOrwhite.color}]}>Manage</Text>
            <TouchableOpacity style={[{paddingVertical: 15}, {borderRadius: 20}, {flexDirection: 'row'}, {alignItems: 'center'}, {marginLeft: 20}]} onPress={handleEditItem}>
              <View style={[{borderRadius: 25}, {padding: 25}, {alignItems: 'center'}, {justifyContent: 'center'}, { backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}>
                <MaterialIcons
                  name="edit"
                  size={30}
                  color={globalStyles.BlackOrwhite.color}
                />
              </View>
              <View style={[{flexDirection: 'column'}, {alignItems: 'flex-start'}]}>
                <Text style={[{marginLeft: 15}, {fontSize: 15}, {fontWeight: '600', color: globalStyles.BlackOrwhite.color}]}>Edit item</Text>
                <Text style={[{marginLeft: 15}, {color: 'grey'}, {maxWidth: '70%', color: globalStyles.DarkGreyOrLightGrey.color}]}>Change item photo and name</Text>
              </View>
              <View style={[{marginLeft: 'auto'}, {marginRight: 20}]}>
                <Icon name="chevron-right" size={30} color={globalStyles.BlackOrwhite.color} />                  
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[{paddingVertical: 15}, {borderRadius: 20}, {flexDirection: 'row'}, {alignItems: 'center'}, {marginLeft: 20}]} onPress={() => {
              handleManageUsers();
              if (welcome5ModalVisible) {
                handleWelcome5Close();
              }
            }}>
              <View style={[{borderRadius: 25}, {padding: 25}, {alignItems: 'center'}, {justifyContent: 'center'}, { backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}>
                <MaterialIcons
                  name="group"
                  size={30}
                  color={globalStyles.BlackOrwhite.color}
                />
              </View>
              <View style={[{flexDirection: 'column'}, {alignItems: 'flex-start'}]}>
                <Text style={[{marginLeft: 15}, {fontSize: 15}, {fontWeight: '600', color: globalStyles.BlackOrwhite.color}]}>Manage users</Text>
                <Text style={[{marginLeft: 15}, {color: 'grey'}, {maxWidth: '70%', color: globalStyles.DarkGreyOrLightGrey.color}]}>Add or remove users</Text>
              </View>
              <View style={[{marginLeft: 'auto'}, {marginRight: 20}]}>
                <Icon name="chevron-right" size={30} color={globalStyles.BlackOrwhite.color} />                  
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[{borderTopWidth: 1}, {borderColor: globalStyles.LightGreyOrDarkGrey.color}, {marginBottom: 120}]}>
            <Text style={[{fontSize:25}, {marginBottom: 25}, {marginTop: 20}, {marginLeft: 20, color: globalStyles.BlackOrwhite.color}]}>Manage</Text>
            <TouchableOpacity style={[{paddingVertical: 15}, {borderRadius: 20}, {flexDirection: 'row'}, {alignItems: 'center'}, {marginLeft: 20}]} onPress={handleViewUsers}>
              <View style={[{borderRadius: 25}, {padding: 25}, {alignItems: 'center'}, {justifyContent: 'center'}, { backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}>
                <MaterialIcons
                  name="group"
                  size={30}
                  color={globalStyles.BlackOrwhite.color}
                />
              </View>
              <View style={[{flexDirection: 'column'}, {alignItems: 'flex-start'}]}>
                <Text style={[{marginLeft: 15}, {fontSize: 15}, {fontWeight: '600', color: globalStyles.BlackOrwhite.color}]}>View Users</Text>
                <Text style={[{marginLeft: 15}, {color: 'grey'}, {maxWidth: '65%', color: globalStyles.DarkGreyOrLightGrey.color}]}>Everyone with access to {itemName}</Text>
              </View>
              <View style={{position: 'absolute', right: 20}}>
                <Icon name="chevron-right" size={30} color={globalStyles.BlackOrwhite.color} />
              </View>
            </TouchableOpacity>
          </View>
        )}
        {welcome5ModalVisible && (
          <View style={{position: 'absolute', left: 20, width: 270, bottom: 450}}>
            <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
              <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Tap the 'Manage users' button below to share this item with your added friends</Text>
              <TouchableOpacity
                style={styles.closeButton2}
                onPress={handleWelcome5Close}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={'white'}
                />
              </TouchableOpacity>
            </View>
            <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '65%'}]} />
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  closeButton2: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  reservationTime: {
    fontSize: 14,
    color: "#777",
    lineHeight: 20,
  },
  reservationContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderWidth: 1,
    borderColor: 'grey',
    borderRadius: 20,
    marginTop: 15,
  },
  rowContainer: {
    flexDirection: 'row',
    marginRight: 10,
    marginTop: 10,
    marginBottom: 6
  },
  nameText: {
    marginTop: 0,
    marginLeft: 10
  },
  friendImage: {
    width: 40,
    height: 40,
    borderRadius: 100,
    marginBottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 35,
    left: 10,
    zIndex: 100,
  },
  button: {  
    borderRadius: 100,        
    paddingVertical: 17,      
    alignItems: 'center',     
    justifyContent: 'center', 
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  verticalScrollView: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 5,
    marginTop: 10,
  },
  sectionTitle: {
    textAlign: 'left',
    marginLeft: 5,
  },
  managerText: {
    fontSize: 15,
    color: '#000',
    textAlign: 'center',
  },
  managerButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    marginBottom: 40,
  },
  currentUserText: {
    fontSize: 15,
    color: '#000',
    textAlign: 'center',
  },
  currentUserButton: {
    backgroundColor: '#87CEEB',
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    marginBottom: 40,
  },
  heartIcon: {
    position: 'absolute',
    top: 35,
    right: 20,
    zIndex: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flexContainer: {
    flex: 1,
  },
  container: {
    padding: 20,
  },
  title: {
    fontSize: 50,
    marginTop: 10,
  },
  bubble: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    marginBottom: 40,
  },
  bubbleText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  noSharedWithText: {
    fontSize: 12,
    color: '#7d7d7d',
    marginTop: 30,
    marginBottom: 30,
    textAlign: 'center',
    width: '100%',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  inUseText: {
    fontSize: 14,
    color: 'gray',
    textAlign: 'center',
  },
});

import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  BackHandler,
  Image,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  query,
  collection,
  getDocs,
  where
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { app } from '../../../configs/firebaseConfig';

export default function ManageUsers() {
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();
  
  const [user, setUser] = useState(null);
  const [sharedWith, setSharedWith] = useState([]);
  const isFocused = useIsFocused();

  // batch-fetch all needed users
  const useUsersData = (emails) => {
    const [map, setMap] = useState({})
    useEffect(() => {
      if (!emails.length) return
      const db = getFirestore(app)
      const fetch = async () => {
        const result = {}
        try {
          const chunks = []
          for (let i = 0; i < emails.length; i += 10) {
            chunks.push(emails.slice(i, i + 10))
          }
          for (const chunk of chunks) {
            const q = query(
              collection(db, 'users'),
              where('email', 'in', chunk)
            )
            const snap = await getDocs(q)
            snap.docs.forEach(doc => {
              const d = doc.data()
              result[d.email] = {
                givenName: d.givenName || null,
                photoURL: d.photoURL || null,
              }
            })
          }
          emails.forEach(e => {
            if (!result[e]) result[e] = { givenName: e, photoURL: null }
          })
          setMap(result)
        } catch {
          const fallback = {}
          emails.forEach(e => {
            fallback[e] = { givenName: e, photoURL: null }
          })
          setMap(fallback)
        }
      }
      fetch()
    }, [emails.join('|')])
    return map
  }

  const emails = useMemo(
    () => [user?.email, ...(sharedWith || [])].filter(Boolean),
    [user, sharedWith]
  )
  const usersData = useUsersData(emails)

  const Display = React.memo(({ email, isYou, onRemove, onPress }) => {
    const { givenName, photoURL } = usersData[email] || {}
    const scheme = useColorScheme()
    const gs = getGlobalStyles(scheme)

    if (givenName === undefined) {
      return (
        <View
          style={{
            width: '100%',
            height: 80,
            borderRadius: 20,
            backgroundColor: gs.LightGreyOrDarkGrey.color,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        />
      )
    }

    return (
      <TouchableOpacity onPress={() => onPress?.(email)} style={{ marginBottom: 10 }}>
        <View
          style={{
            width: '100%',
            height: 80,
            borderRadius: 20,
            backgroundColor: gs.LightGreyOrDarkGrey.color,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 0,
          }}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.friendImage} />
          ) : (
            <MaterialIcons
              name="account-circle"
              size={50}
              color={gs.DarkGreyOrLightGrey.color}
            />
          )}

          <View style={{ marginLeft: 10 }}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ color: gs.BlackOrwhite.color }}>{givenName}</Text>
              {isYou && (
                <Text style={{ color: gs.BlackOrwhite.color }}> (You)</Text>
              )}
            </View>
            <Text style={[styles.managerText, { color: gs.DarkGreyOrLightGrey.color }]}>
              {email}
            </Text>
          </View>

          {onRemove && (
            <TouchableOpacity
              onPress={() => onRemove(email)}
              style={{ position: 'absolute', right: 20, top: 27 }}
            >
              <MaterialIcons
                name="close"
                size={25}
                color={gs.BlackOrwhite.color}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    )
  })

  const handleBackPress = useCallback(() => {
    router.replace({ pathname: '/(inspect)', params: { itemId, fromHome } });
    return true;
  }, [router, itemId, fromHome]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBackPress
      );
      return () => subscription.remove();
    }, [handleBackPress])
  );

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    const authInstance = getAuth(app);
    const db = getFirestore(app);
    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (currentUser && itemId) {
        const itemDocRef = doc(db, 'items', itemId);
        getDoc(itemDocRef)
          .then(docSnap => {
            if (docSnap.exists) {
              setSharedWith(docSnap.data().sharedWith || []);
            }
          })
          .catch(error =>
            console.error('Error fetching item document:', error)
          );
      }
    });

    return () => unsubscribe();
  }, [itemId]);
  
  useEffect(() => {
    setLoading(true);

    const delayPerUser = 100;
    const rawDelay = sharedWith.length * delayPerUser;
    const delay = Math.min(Math.max(rawDelay, 100), 5000);

    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, [sharedWith]);

  const handleRemoveUser = async (userToRemove) => {
    Alert.alert(
      'Confirm Removal',
      `Are you sure you want to remove ${userToRemove}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              const db = getFirestore(app);
              // Update the sharedWith array on the item doc
              const updatedSharedWith = sharedWith.filter((u) => u !== userToRemove);
              setSharedWith(updatedSharedWith);
              await updateDoc(doc(db, 'items', itemId), {
                sharedWith: updatedSharedWith
              });

              // Remove the item from the specified user's favourites array
              // Query the users collection for a document with email equal to userToRemove
              const userQuery = query(
                collection(db, "users"),
                where("email", "==", userToRemove)
              );
              const querySnapshot = await getDocs(userQuery);
              // If a matching document is found, update its favourites field
              if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();
                const favourites = userData.favourites || [];
                const updatedFavourites = favourites.filter((favId) => favId !== itemId);

                await updateDoc(userDoc.ref, {
                  favourites: updatedFavourites,
                });
              } else {
                console.log(`No user found with email: ${userToRemove}`);
              }

              const itemDocRef = doc(db, 'items', itemId);
              const itemDocSnap = await getDoc(itemDocRef);
              if (itemDocSnap.exists) {
                if (itemDocSnap.data().inUseBy.includes(userToRemove)) {
                  if (itemDocSnap.data().needsImmediateUpdate) {
                    await updateDoc(doc(db, 'items', itemId), {
                      availability: true,
                      availabilityChangeTime: null,
                      needsImmediateUpdate: false,
                      inUseBy: [],
                    });
                  }
                  if (itemDocSnap.data().needsScheduledEndUpdate) {
                    // Remove the first scheduled change time.
                    const newScheduledTimes = itemDocSnap.data().availabilityScheduledChangeTime.slice(1);
                    // Get the next scheduled change time if available.
                    const nextTime =
                      itemDocSnap.data().availabilityScheduledChangeTime.length > 0
                        ? itemDocSnap.data().availabilityScheduledChangeTime[0]
                        : null;
                    // Determine if further scheduling is needed.
                    const needsFurtherUpdate = itemDocSnap.data().availabilityScheduledChangeTime.length > 0;

                    await updateDoc(itemDocRef, {
                      availability: true,
                      availabilityScheduledChangeTime: newScheduledTimes,
                      nextAvailabilityScheduledChangeTime: nextTime,
                      needsScheduledEndUpdate: false,
                      needsScheduledStartUpdate: needsFurtherUpdate,
                      inUseBy: [],
                    });
                  }
                }
                if (itemDocSnap.data().scheduledBy.includes(userToRemove)) {
                  // Get the original document data.
                  const refreshedDocSnap = await getDoc(itemDocRef);
                  const itemData = refreshedDocSnap.data();

                  // Clone the arrays so as not to directly mutate the original data.
                  let newScheduledBy = [...(itemData.scheduledBy || [])];
                  let newAvailabilityStartTime = [...(itemData.availabilityStartTime || [])];
                  let newAvailabilityScheduledChangeTime = [
                    ...(itemData.availabilityScheduledChangeTime || [])
                  ];

                  // Prepare the initial nextAvailabilityScheduledChangeTime.
                  let newNextAvailabilityScheduledChangeTime = itemData.nextAvailabilityScheduledChangeTime;

                  // Loop through scheduledBy; for each occurrence of userToRemove, run the removal code
                  while (newScheduledBy.includes(userToRemove)) {
                    // Get the current index of userToRemove
                    const index = newScheduledBy.indexOf(userToRemove);
                    
                    if (index === -1) break; // safety check

                    // For the first reservation, remove the first element from the schedule.
                    if (index === 0) {
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
                    newScheduledBy.splice(index, 1);
                    newAvailabilityStartTime.splice(index, 1);
                  }

                  // Determine if another scheduled start update is needed.
                  const newNeedsScheduledStartUpdate = newAvailabilityStartTime.length > 0;

                  // Update the item document
                  const db = getFirestore(app);
                  const itemRef = doc(db, "items", itemId);
                  await updateDoc(itemRef, {
                    nextAvailabilityScheduledChangeTime: newNextAvailabilityScheduledChangeTime,
                    availabilityScheduledChangeTime: newAvailabilityScheduledChangeTime,
                    availabilityStartTime: newAvailabilityStartTime,
                    scheduledBy: newScheduledBy,
                    needsScheduledStartUpdate: newNeedsScheduledStartUpdate,
                  });
                }
              }

            } catch (error) {
              console.error('Error removing user:', error);
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  const handlePress = useCallback((userEmail) => {
    router.push({
      pathname: '/(profileInspect)',
      params: { userEmail }
    });
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      {loading && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: globalStyles.mainBackgroundColor.color,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            },
          ]}
        >
          <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
        </View>
      )}
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace({ pathname: '/(inspect)', params: { itemId, fromHome } })}>
        <MaterialIcons
          name="arrow-back"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      <Text style={[{fontSize: 25, marginTop: 100, marginLeft: 20, color: globalStyles.BlackOrwhite.color}]}>People with access</Text>
      <Text style={{ marginTop: 20, marginLeft: 20, marginRight: 40, color: 'grey', color: globalStyles.DarkGreyOrLightGrey.color }}>Press add to give access to your friends or choose to revoke access below</Text>
      <View style={{marginHorizontal: 20, marginTop: 20, marginBottom: 40}}>
        <TouchableOpacity
          style={{
            padding: 15,
            backgroundColor: globalStyles.mainColor.color,
            borderRadius: 100,
            width: '100%',
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            alignSelf: 'center',
            flexDirection: 'row'
          }}
          onPress={() =>
            router.push({
              pathname: '/(inspect)/manageUsers/share',
              params: { itemId, fromHome }
            })
          }
        >
          <MaterialIcons name="add" size={20} color="white" />
          <Text style={{ color: 'white', fontWeight: 600, marginLeft: 5 }}>Add</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {user?.email && (
          <Display
            email={user.email}
            isYou
            onPress={handlePress}
          />
        )}
        {sharedWith.map(email => (
          <Display
            key={email}
            email={email}
            onPress={handlePress}
            onRemove={handleRemoveUser}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  friendImage: {
    width: 50,
    height: 50,
    borderRadius: 100,
    marginLeft: 15,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  scrollViewWrapper: {
    flex: 1,
    marginTop: 60,
    marginBottom: 80
  },
  optionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center'
  },
  managerText: {
    fontSize: 12,
    color: 'grey',
    textAlign: 'center',
  },
  removeButtonText: {
    color: '#ff0000',
    fontWeight: 'bold'
  },
  shareButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 5
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
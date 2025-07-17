import getGlobalStyles from '../globalStyles';
import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';

import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  collection,
  where,
  query,
  getDocs,
  deleteDoc,
  writeBatch
} from '@react-native-firebase/firestore';

import { getAuth, onAuthStateChanged, signOut } from '@react-native-firebase/auth';

import { app } from '../../configs/firebaseConfig';

export default function EditName() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [message, setMessage] = useState('');
  const [sharedWith, setSharedWith] = useState([]);
  const [loading, setLoading] = useState(false);

  const randomMessages = ["Hello", "Hi", "Greetings"];
  
  const getRandomMessage = () => {
    const randomIndex = Math.floor(Math.random() * randomMessages.length);
    return randomMessages[randomIndex];
  };

  useEffect(() => {
    const authInstance = getAuth(app);
    let unsubscribeUrlListener;
    const unsubscribeAuth = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeUrlListener = fetchUrl(currentUser.uid);
      } else {
        setUrl('');
      }
    });
    setMessage(getRandomMessage());
    return () => {
      unsubscribeAuth();
      if (unsubscribeUrlListener) unsubscribeUrlListener();
    };
  }, []);

  const fetchUrl = (userId) => {
    if (!userId) return;
    setLoadingUrl(true);
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const userData = docSnapshot.data();
          const photoUrl = userData.photoURL || '';
          const userName = userData.givenName || '';
          const email = userData.email || '';
          setUrl(photoUrl);
          setName(userName);
          setEmail(email);
        } else {
          setUrl('');
        }
        setLoadingUrl(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching url: ', error);
      setLoadingUrl(false);
    }
  };

  const handleDeleteAccount = async (userToRemove) => {
    Alert.alert(
      'Confirm Deletion',
      `Your app data will be permanently deleted`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          onPress: async () => {
            setLoading(true);
            const db           = getFirestore(app)
            const authInstance = getAuth(app)

            try {
              // 0) DELETE USER-CREATED ITEMS
              const createdItemsQ    = query(
                collection(db, 'items'),
                where('createdBy', '==', userToRemove)
              )
              const createdItemsSnap = await getDocs(createdItemsQ)
              for (const itemSnap of createdItemsSnap.docs) {
                await deleteDoc(doc(db, 'items', itemSnap.id))
              }

              // 1) CLEAN UP ITEMS (sharedWith, inUseBy, scheduledBy, etc.)
              const itemsQ    = query(
                collection(db, 'items'),
                where('sharedWith', 'array-contains', userToRemove)
              )
              const itemsSnap = await getDocs(itemsQ)

              for (const itemSnap of itemsSnap.docs) {
                const itemRef = doc(db, 'items', itemSnap.id)
                const data    = itemSnap.data()
                const updates = {
                  sharedWith: (data.sharedWith || []).filter(u => u !== userToRemove)
                }

                if (data.inUseBy?.includes(userToRemove)) {
                  if (data.needsImmediateUpdate) {
                    Object.assign(updates, {
                      availability: true,
                      availabilityChangeTime: null,
                      needsImmediateUpdate: false,
                      inUseBy: []
                    })
                  }
                  if (data.needsScheduledEndUpdate) {
                    const sched = data.availabilityScheduledChangeTime || []
                    const next  = sched[0] ?? null
                    Object.assign(updates, {
                      availability: true,
                      availabilityScheduledChangeTime: sched.slice(1),
                      nextAvailabilityScheduledChangeTime: next,
                      needsScheduledEndUpdate: false,
                      needsScheduledStartUpdate: sched.length > 1,
                      inUseBy: []
                    })
                  }
                }

                if (data.scheduledBy?.includes(userToRemove)) {
                  let sb        = [...(data.scheduledBy || [])]
                  let startTs   = [...(data.availabilityStartTime || [])]
                  let schedTs   = [...(data.availabilityScheduledChangeTime || [])]
                  let nextSched = data.nextAvailabilityScheduledChangeTime

                  while (sb.includes(userToRemove)) {
                    const idx = sb.indexOf(userToRemove)
                    if (idx === 0) {
                      nextSched = schedTs.length ? schedTs.shift() : null
                    } else if (idx > 0 && idx - 1 < schedTs.length) {
                      schedTs.splice(idx - 1, 1)
                    }
                    sb.splice(idx, 1)
                    startTs.splice(idx, 1)
                  }

                  Object.assign(updates, {
                    scheduledBy: sb,
                    availabilityStartTime: startTs,
                    availabilityScheduledChangeTime: schedTs,
                    nextAvailabilityScheduledChangeTime: nextSched,
                    needsScheduledStartUpdate: startTs.length > 0
                  })
                }

                await updateDoc(itemRef, updates)
              }

              // 2) CLEAN UP OTHER USERS’ ASSOCIATIONS (batch)
              const assocQ    = query(
                collection(db, 'users'),
                where('associated', 'array-contains', userToRemove)
              )
              const assocSnap = await getDocs(assocQ)
              const batch     = writeBatch(db)

              assocSnap.docs.forEach(docSnap => {
                const arr      = docSnap.data().associated || []
                const filtered = arr.filter(e => e !== userToRemove)
                batch.update(
                  doc(db, 'users', docSnap.id),
                  { associated: filtered }
                )
              })

              await batch.commit()

              // 3) DELETE THEIR NOTIFICATIONS DOC
              const userQ    = query(
                collection(db, 'users'),
                where('email', '==', userToRemove)
              )
              const userSnap = await getDocs(userQ)

              if (!userSnap.empty) {
                const userDoc = userSnap.docs[0]
                const userId  = userDoc.id

                await deleteDoc(doc(db, 'notifications', userId))
                // 4) DELETE THE USER DOCUMENT
                await deleteDoc(userDoc.ref)
              }

              // 5) SIGN OUT
              await signOut(authInstance)

              console.log(`Removed ${userToRemove} completely.`)
            } catch (err) {
              console.error('Error during account cleanup:', err)
            }

            router.push('/(backup)')
          }
        }
      ],
      { cancelable: true }
    )
  }

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalStyles.mainBackgroundColor.color}}>
        <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <View style={{flexDirection: 'row', marginTop: 40, alignItems: 'center', marginLeft: 20}}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons
            name="arrow-back"
            size={28}
            color={globalStyles.BlackOrwhite.color}
          />
        </TouchableOpacity>
        <Text style={{fontSize: 22, textAlign: 'left',color: globalStyles.BlackOrwhite.color, marginLeft: 15}}>
          Account
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginBottom: 10, marginTop: 20 }}>
        <View style={styles.profileContainer}>
          <View>
            {url ? (
              <Image source={{ uri: url }} style={styles.profileImage} />
            ) : (
              <MaterialIcons
                name="account-circle"
                size={150}
                color={globalStyles.DarkGreyOrLightGrey.color}
              />
            )}
          </View>
        </View>

        <Text style={{ fontSize: 30, marginBottom: 40, color: globalStyles.BlackOrwhite.color }}>{name}</Text>
      </View>

      <View style={{marginLeft: 20}}>
        <TouchableOpacity
          style={styles.textButton}
          onPress={() => {
            router.push('/(account)/editProfilePic')
          }}
        >
          <MaterialIcons
            name="account-circle"
            size={30}
            color={globalStyles.BlackOrwhite.color}
          />
          <View style={styles.textInside}>
            <Text style={[{ fontSize: 17, marginLeft: 15, marginBottom: 2, color: globalStyles.BlackOrwhite.color }]}>
              Profile picture
            </Text>
            <Text style={[{ fontSize: 15, marginLeft: 15, color: globalStyles.DarkGreyOrLightGrey.color }]}>
              Choose the picture others see
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textButton}
          onPress={() => {
            router.push('/(account)/editName')
          }}
        >
          <MaterialIcons
            name="badge"
            size={30}
            color={globalStyles.BlackOrwhite.color}
          />
          <View style={styles.textInside}>
            <Text style={[{ fontSize: 17, marginLeft: 15, marginBottom: 2, color: globalStyles.BlackOrwhite.color }]}>
              Display name
            </Text>
            <Text style={[{ fontSize: 15, marginLeft: 15, color: globalStyles.DarkGreyOrLightGrey.color }]}>
              Choose the name others see
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={{position: 'absolute', bottom: 60, left: 20}} onPress={() => handleDeleteAccount(email)}>
        <Text style={{fontSize: 17, color: 'red'}}>Delete account</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  inputDescription: {
    fontSize: 15,
    color: '#7d7d7d',
  },
  inputContainer: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  textInside: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  profileContainer: {
    alignItems: 'flex-start',
    marginTop: 50,
    marginBottom: 15,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  textButton: {
    width: 220,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 17,
  },
  fullModalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#4CAF50',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 19,
    marginLeft: 15,
    color: 'white',
  },
  saveText: {
    color: 'white',
    fontSize: 14,
    marginRight: 10,
    fontWeight: '600',
  },
  fullModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalInput: {
    height: 40,
    width: '100%',
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    paddingHorizontal: 15,
    fontSize: 17,
  },
});
import React, { useEffect, useState } from 'react';
import getGlobalStyles from '../globalStyles';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { app } from '../../configs/firebaseConfig';

export default function ProfileInspect() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);

  const { userEmail } = useLocalSearchParams();
  const currentUser = getAuth(app).currentUser;

  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEmailAssociated, setIsEmailAssociated] = useState(false);
  const [isEmailRequestedBy, setIsEmailRequestedBy] = useState(false);
  const isFocused = useIsFocused();

  const [isFriendRequestReceived, setIsFriendRequestReceived] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    // Fetch target user's details
    const fetchUserDetails = async () => {
      try {
        setError('');
        const db = getFirestore(app);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          setUserDetails(userData);
          // Check if currentUser's already sent a friend request.
          if (currentUser?.email) {
            setIsEmailRequestedBy(
              userData.requestedBy && userData.requestedBy.includes(currentUser.email)
            );
          }
        } else {
          setError('No matching user document found.');
        }
      } catch (err) {
        setError(`Error fetching user details: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Check if the current user and the friend are already associated
    const checkEmailAssociation = async () => {
      try {
        const db = getFirestore(app);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const currentUserDoc = await getDoc(userDocRef);
        if (currentUserDoc.exists) {
          const { associated = [] } = currentUserDoc.data();
          setIsEmailAssociated(associated.includes(userEmail));
        }
      } catch (err) {
        console.error('Error checking email association:', err);
      }
    };

    // Check if the current user has an incoming friend request from the inspected profile
    const checkFriendRequestReceived = async () => {
      try {
        const db = getFirestore(app);
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        if (currentUserDoc.exists) {
          const { requestedBy = [] } = currentUserDoc.data();
          setIsFriendRequestReceived(requestedBy.includes(userEmail));
        }
      } catch (err) {
        console.error('Error checking incoming friend request:', err);
      }
    };

    if (userEmail) {
      fetchUserDetails();
      if (currentUser) {
        checkEmailAssociation();
        checkFriendRequestReceived();
      }
    }
  }, [userEmail, currentUser]);

  // Friend request function to send a request to the inspected profile
  const friendRequest = async () => {
    if (currentUser && userEmail) {
      try {
        const db = getFirestore(app);
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userDocRef = doc(db, 'users', userDoc.id);
          const cuserDocRef = doc(db, 'users', currentUser.uid)
          await updateDoc(userDocRef, {
            requestedBy: arrayUnion(currentUser.email),
          });
          await updateDoc(cuserDocRef, {
            noFriendsVisible: false,
          });
          setIsEmailRequestedBy(true);
        } else {
          alert('No matching user document found.');
        }
      } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Error sending friend request. Please try again.');
      }
    }
  };

  const handleRemove = () => {
    Alert.alert('Confirm Removal', 'Are you sure you want to remove this friend?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: removeFriend },
    ]);
  };

  const removeFriend = async () => {
    if (currentUser && userEmail) {
      try {
        const db = getFirestore(app);
        // Remove friend from current user's associated list
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
          associated: arrayRemove(userEmail),
        });
        // Remove current user's email from the friend's associated list
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userDocRef = doc(db, 'users', userDoc.id);
          await updateDoc(userDocRef, {
            associated: arrayRemove(currentUser.email),
          });
          setIsEmailAssociated(false);
          router.back();
        } else {
          console.error('Error: User document not found.');
          alert('Error removing friend. Please try again.');
        }
      } catch (error) {
        console.error('Error removing friend:', error);
        alert('Error removing friend. Please try again.');
      }
    }
  };

  const acceptFriendRequest = async () => {
    if (currentUser && userEmail) {
      try {
        const db = getFirestore(app);
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
          requestedBy: arrayRemove(userEmail),
          associated: arrayUnion(userEmail),
        });
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const friendDoc = querySnapshot.docs[0];
          const friendDocRef = doc(db, 'users', friendDoc.id);
          await updateDoc(friendDocRef, {
            associated: arrayUnion(currentUser.email),
          });
        }
        alert('Friend request accepted successfully!');
        setIsEmailAssociated(true);
        setIsFriendRequestReceived(false);
      } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('Error accepting friend request. Please try again.');
      }
    }
  };

  const declineFriendRequest = async () => {
    if (currentUser && userEmail) {
      try {
        const db = getFirestore(app);
        const currentUserRef = doc(db, 'users', currentUser.uid);
        await updateDoc(currentUserRef, {
          requestedBy: arrayRemove(userEmail),
        });
        setIsFriendRequestReceived(false);
      } catch (error) {
        console.error('Error declining friend request:', error);
        alert('Error declining friend request. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalStyles.mainBackgroundColor.color}}>
        <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: globalStyles.mainBackgroundColor.color },
        ]}
      >
        <Text>{error}</Text>
      </View>
    );
  }

  if (!userDetails) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: globalStyles.mainBackgroundColor.color },
        ]}
      >
        <Text>No details available for user {userEmail}</Text>
      </View>
    );
  }

  const { email, photoURL, givenName } = userDetails;

  return (
    <ScrollView contentContainerStyle={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/(friends)')}>
        <MaterialIcons
          name="close"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      <View>
        <View style={[styles.profileContainer, { marginTop: 100 }]}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.profileImage} />
          ) : (
            <View style={styles.placeholderImage}>
              <Ionicons name="person" size={100} color="#7d7d7d" />
            </View>
          )}
          <Text style={[styles.givenName, {color: globalStyles.BlackOrwhite.color}]}>{givenName || 'No Name Provided'}</Text>
        </View>

        <View
          style={[
            { flexDirection: 'row' },
            { alignItems: 'center' },
            { justifyContent: 'center' },
          ]}
        >
          <MaterialIcons
            name="email"
            size={25}
            color={globalStyles.DarkGreyOrLightGrey.color}
          />
          <Text style={[styles.title, { marginLeft: 10, color: globalStyles.DarkGreyOrLightGrey.color }]}>
            {email}
          </Text>
        </View>
        {isFriendRequestReceived && (
          <View style={{flexDirection: 'column', borderWidth: 1, borderColor: 'grey', borderRadius: 20, marginHorizontal: 20, marginTop: 60, padding: 20}}>
            <Text style={{color: globalStyles.BlackOrwhite.color}}>Accept {givenName}'s friend request?</Text>
            <View style={{flexDirection: 'row', marginTop: 20, alignItems: 'center', justifyContent: 'space-between'}}>
              <TouchableOpacity
                style={[{ backgroundColor: globalStyles.mainColor.color }, styles.button2]}
                onPress={acceptFriendRequest}
              >
                <Text style={{ color: 'white', fontWeight: 600 }}>
                  Accept
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ backgroundColor: globalStyles.LightGreyOrDarkGrey.color }, styles.button2]}
                onPress={declineFriendRequest}
              >
                <Text style={{ color: globalStyles.BlackOrwhite.color, fontWeight: 600 }}>
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.footer, {backgroundColor: 'transparent', borderTopColor: globalStyles.LightGreyOrDarkGrey.color}]}>
        {isFriendRequestReceived ? (
          <Text style={styles.emptyMessage}>Friend request recieved</Text>
        ) : (
          !isEmailAssociated && !isEmailRequestedBy ? (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: globalStyles.mainColor.color }]}
              onPress={friendRequest}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>Add friend</Text>
            </TouchableOpacity>
          ) : isEmailAssociated ? (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'red' }]}
              onPress={handleRemove}
            >
              <Text style={[styles.buttonText, { color: 'red' }]}>Remove friend</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.emptyMessage}>Friend request has been sent</Text>
          )
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button2: {
    padding: 10,
    borderRadius: 20,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  container: {
    flex: 1,
    padding: 16,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 16,
    zIndex: 10,
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  placeholderImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#efefef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  givenName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  title: {
    fontSize: 16,
  },
  footer: {
    height: 100,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopColor: '#e6e6e6',
    borderTopWidth: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  button: {
    width: '85%',
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
  buttonText: {
    fontSize: 16,
  },
  emptyMessage: {
    color: 'grey',
  },
});
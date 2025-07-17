import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import getGlobalStyles from '../../../app/globalStyles';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { app } from '../../../configs/firebaseConfig';

export default function Friends() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsDetails, setFriendsDetails] = useState([]);
  const [friendRequestsDetails, setFriendRequestsDetails] = useState([]);

  const [loadingFriendsArray, setLoadingFriendsArray] = useState(true);    
  const [loadingFriendsDetails, setLoadingFriendsDetails] = useState(true);

  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    setLoadingFriends(loadingFriendsArray || loadingFriendsDetails);
  }, [loadingFriendsArray, loadingFriendsDetails]);

  useFocusEffect(
    React.useCallback(() => {
      const backAction = () => {
        BackHandler.exitApp();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );
      return () => subscription.remove();
    }, [])
  );

  // Listen for auth state changes. Once a user is detected, fetch their friend arrays.
  useEffect(() => {
    const authInstance = getAuth(app);
    let unsubscribeFriendsListener;
    const unsubscribeAuth = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Begin loading friends array fetch
        unsubscribeFriendsListener = fetchFriends(currentUser.uid);
      } else {
        setFriends([]);
        setFriendRequests([]);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeFriendsListener) unsubscribeFriendsListener();
    };
  }, []);

  // Listen to changes in the current user’s document to update friend/friend request arrays.
  const fetchFriends = (userId) => {
    if (!userId) return;
    setLoadingFriendsArray(true);
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', userId);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const userData = docSnapshot.data();
          const friendsList = userData.associated || [];
          const friendRequestsList = userData.requestedBy || [];
          setFriends(friendsList);
          setFriendRequests(friendRequestsList);
        } else {
          setFriends([]);
          setFriendRequests([]);
        }
        setLoadingFriendsArray(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching friends: ', error);
      setLoadingFriendsArray(false);
    }
  };

  const fetchUsersByEmails = async (emails) => {
    if (!emails || emails.length === 0) return [];
    try {
      const db = getFirestore(app);
      const q = query(collection(db, 'users'), where('email', 'in', emails));
      const snapshot = await getDocs(q);
      let usersArray = [];
      snapshot.forEach((doc) => {
        usersArray.push(doc.data());
      });
      return usersArray;
    } catch (error) {
      console.error('Error fetching users by emails: ', error);
      return [];
    }
  };

  useEffect(() => {
    setLoadingFriendsDetails(true);
    const fetchDetails = async () => {
      try {
        // Fetch detailed data for friends and friend requests concurrently.
        const friendDetailsPromise = friends.length > 0
          ? fetchUsersByEmails(friends)
          : Promise.resolve([]);
        const friendRequestsDetailsPromise = friendRequests.length > 0
          ? fetchUsersByEmails(friendRequests)
          : Promise.resolve([]);
    
        const [friendsData, friendRequestsData] = await Promise.all([
          friendDetailsPromise,
          friendRequestsDetailsPromise
        ]);
        
        setFriendsDetails(friendsData);
        setFriendRequestsDetails(friendRequestsData);
      } catch (error) {
        console.error('Error fetching detailed friend data:', error);
      } finally {
        setLoadingFriendsDetails(false);
      }
    };
    fetchDetails();
  }, [friends, friendRequests]);

  const handlePress = (userEmail) => {
    router.push({
      pathname: '/(profileInspect)',
      params: { userEmail },
    });
  };

  const handleAddPress = () => {
    router.push('/(friendSearch)');
  };

  const handleAcceptRequest = async (requesterEmail) => {
    if (!user) return;
    const currentUserEmail = user.email;
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        associated: arrayUnion(requesterEmail),
        requestedBy: arrayRemove(requesterEmail),
      });

      // Find the requester’s document by their email.
      const requesterQuery = query(
        collection(db, 'users'),
        where('email', '==', requesterEmail)
      );
      const requesterSnapshot = await getDocs(requesterQuery);
      if (!requesterSnapshot.empty) {
        const requesterDoc = requesterSnapshot.docs[0];
        const requesterDocRef = doc(db, 'users', requesterDoc.id);
        await updateDoc(requesterDocRef, {
          associated: arrayUnion(currentUserEmail),
        });
        setFriendRequests((prev) => prev.filter((req) => req !== requesterEmail));
      } else {
        console.error('Error: Requester document not found.');
      }
    } catch (error) {
      console.error('Error accepting friend request: ', error);
    }
  };

  const handleDeclineRequest = async (requesterEmail) => {
    if (!user) return;
    const db = getFirestore(app);
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, {
        requestedBy: arrayRemove(requesterEmail),
      });
      setFriendRequests((prev) => prev.filter((req) => req !== requesterEmail));
    } catch (error) {
      console.error('Error declining friend request: ', error);
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color}}>
      <TouchableOpacity style={[styles.floatingButton, {backgroundColor: globalStyles.brightMainColor.color}]} onPress={handleAddPress}>
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.buttonText}>Add</Text>
      </TouchableOpacity>
      <ScrollView
        contentContainerStyle={styles.scrollViewContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.friendRequestsContainer}>
          {friendRequestsDetails.length > 0 && (
            <View style={styles.requestsContainer}>
              <Text style={[styles.sectionTitle, {color: globalStyles.BlackOrwhite.color}]}>Friend Requests</Text>
              {friendRequestsDetails.map((request, index) => (
                <View key={index} style={styles.request}>
                  <TouchableOpacity
                    onPress={() => handlePress(request.email)}
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                  >
                    {request.photoURL ? (
                      <Image
                        source={{ uri: request.photoURL }}
                        style={styles.friendRequestImage}
                      />
                    ) : (
                      <MaterialIcons name="account-circle" size={40} color={globalStyles.LightGreyOrDarkGrey.color} />
                    )}
                    <View style={styles.requestTextContainer}>
                      <Text style={[styles.requestName, {color: globalStyles.BlackOrwhite.color}]}>{request.givenName}</Text>
                      <Text style={[styles.requestEmail, {color: globalStyles.DarkGreyOrLightGrey.color}]}>{request.email}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptButton, {backgroundColor: globalStyles.mainColor.color}]}
                    onPress={() => handleAcceptRequest(request.email)}
                  >
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.declineButton, {backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}
                    onPress={() => handleDeclineRequest(request.email)}
                  >
                    <Text style={[styles.declineButtonText, {color: globalStyles.BlackOrwhite.color}]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={styles.friendsContainer}>
          {loadingFriends ? (
            <View style={styles.loadingContainer}>
            </View>
          ) : friendsDetails.length > 0 ?
            friendsDetails.map((friend, index) => (
              <View key={index} style={styles.friendContainer}>
                <TouchableOpacity
                  style={[styles.optionButton, {backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}
                  onPress={() => handlePress(friend.email)}
                >
                  {friend.photoURL ? (
                    <Image 
                      source={{ uri: friend.photoURL }} 
                      style={styles.friendImage} 
                    />
                  ) : (
                    <Ionicons name="person" size={60} color={globalStyles.DarkGreyOrLightGrey.color} />
                  )}
                </TouchableOpacity>
                <Text style={[styles.friendGivenName, {color: globalStyles.BlackOrwhite.color}]}>{friend.givenName}</Text>
              </View>
            )) : (
              <View style={styles.friendContainer}>
                <Text style={[styles.emptyMessage, { marginTop: 80 }]}>
                  You have no friends added
                </Text>
              </View>
            )
          }
        </View>
      </ScrollView>
      {/*
      {friendsDetails.length === 0 && !loadingFriends && (
        <View style={{position: 'absolute', left: '25%', width: '70%', bottom: 90}}>
          <View style={{backgroundColor: globalStyles.mainColor.color, borderRadius: 15, paddingVertical: 30, paddingHorizontal: 30, elevation: 2}}>
            <Text style={{color: 'white', fontWeight: 500, fontSize: 17}}>Press this 'Add' button to add friends</Text>
          </View>
          <View style={[styles.triangle, {borderTopColor: globalStyles.mainColor.color, marginLeft: '75%'}]} />
        </View>
      )}
      */}
    </View>
  );
  
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton2: {
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
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: 100,
    height: 60,
    right: 20,
    bottom: 20,
    elevation: 5,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    zIndex: 100
  },
  addFriendBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  requestTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  requestName: {
    fontSize: 15,
  },
  requestEmail: {
    fontSize: 10,
    color: '#555',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 15,
    textAlign: 'left',
    marginLeft: 20,
    fontWeight: '500',
  },
  emptyMessage: {
    fontSize: 13,
    color: '#7d7d7d',
    marginTop: 50,
    marginBottom: 50,
    textAlign: 'center',
    width: '100%',
  },
  friendsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-evenly',
    marginTop: 40,
    marginBottom: 80
  },
  scrollViewContainer: {
    flexDirection: 'column',
  },
  friendRequestsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  friendContainer: {
    alignItems: 'center',
    marginHorizontal: 0,
    marginBottom: 30,
  },
  optionButton: {
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendImage: {
    width: 130,
    height: 130,
    borderRadius: 100,
  },
  friendGivenName: {
    marginTop: 5,
    fontSize: 15,
    textAlign: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    marginLeft: 8,
  },
  requestsContainer: {
    width: '100%',
    padding: 10,
    marginBottom: 20,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 10,
    marginVertical: 5,
    borderRadius: 10,
  },
  friendRequestImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 0,
  },
  requestText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  acceptButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 10,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 600
  },
  declineButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 3,
  },
  declineButtonText: {
    color: 'black',
    fontSize: 13,
    fontWeight: 600
  },
  addFriendContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
});

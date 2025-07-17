import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  useColorScheme, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

// Modular Firestore imports
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  query,
  getDocs,
  where,
  updateDoc
} from '@react-native-firebase/firestore';
// Modular Auth imports
import { getAuth } from '@react-native-firebase/auth';
// Import your initialized Firebase app (adjust the path as necessary)
import { app } from '../../../configs/firebaseConfig';

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

const Display = React.memo(({ email }) => {
  const colorScheme = useColorScheme();
  const { givenName } = useUserData(email);
  const globalStyles = getGlobalStyles(colorScheme);
  const { photoURL } = useUserData(email);
  return (
    <View>
      {photoURL === false || givenName === false ? (
        <View style={{width: '100%', height: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 0}}>
        </View>
      ) : (
        <View style={{width: '100%', height: 80, flexDirection: 'row', alignItems: 'center', paddingVertical: 15, marginBottom: 0}}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.friendImage} />
          ) : (
            <MaterialIcons
              name="account-circle"
              size={50}
              color={globalStyles.DarkGreyOrLightGrey.color}
              style={{ marginLeft: 14, marginRight: 1 }}
            />
          )}
          <View style={{flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', marginLeft: 10}}>
            <View style={{flexDirection: 'row'}}>
              <Text style={{color: globalStyles.BlackOrwhite.color}}>
                {givenName}
              </Text>
            </View>
            <Text style={[styles.managerText,{color: globalStyles.DarkGreyOrLightGrey.color}]}>{email}</Text>
          </View>
        </View>
      )}
    </View>
  )
})

export default function Details() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const { name } = useLocalSearchParams();

  // Get the Auth instance and current user from your initialized app
  const authInstance = getAuth(app);
  const currentUser = authInstance.currentUser;
  
  const [user, setUser] = useState(currentUser);
  const [associated, setAssociated] = useState([]);
  const [loading, setLoading] = useState(false);
  // New flag state to indicate loading is complete:
  const [associatedLoaded, setAssociatedLoaded] = useState(false);
  const [selected, setSelected] = useState([]);

  const [firstItemYet, setFirstItemYet] = useState(false);

  // Listen for auth state changes and update the associated list
  useEffect(() => {
    const authUnsubscribe = getAuth(app).onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        const db = getFirestore(app);
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef)
          .then((docSnap) => {
            if (docSnap.exists) {
              const data = docSnap.data();
              setAssociated(data.associated || []);
              // Mark that we've loaded the associated data
              setAssociatedLoaded(true);
              if (data.firstItemYet) {
                setFirstItemYet(true);
              }
            } else {
              console.warn("User document does not exist.");
              setAssociatedLoaded(true); // Even if no doc, mark as loaded.
            }
          })
          .catch((err) => {
            console.error("Error fetching associated list:", err);
            setAssociatedLoaded(true);
          });
      }
    });
    return () => authUnsubscribe();
  }, []);

  // Auto-press Finish if associated is loaded and is empty
  useEffect(() => {
    if (associatedLoaded && associated.length === 0) {
      // Optional: You could add a slight delay if needed
      handleFinishPress();
    }
  }, [associated, associatedLoaded]);

  // Toggle selection for sharing
  const toggleSelection = (item) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  // Add new item (with name, share list, etc.) to Firestore
  const addNameToFirestore = async () => {
    setLoading(true);
    if (!user) {
      console.error('User is not authenticated');
      return;
    }

    try {
      const db = getFirestore(app);
      await addDoc(collection(db, 'items'), {
        name: name,
        createdAt: serverTimestamp(),
        userId: user.uid,
        createdBy: user.email,
        sharedWith: selected,
        availability: true,
        inUseBy: [],
        availabilityChangeTime: null,
        availabilityStartTime: [],
        availabilityScheduledChangeTime: [],
        scheduledBy: [],
        nextAvailabilityScheduledChangeTime: null,
      });
      const userDocRef = doc(db, 'users', user.uid);
      if (!firstItemYet) {
        await updateDoc(userDocRef, {
          firstItemYet: true,
          noFriendsVisible: true,
        });
      }
      console.log('Name added!');
      router.replace('/(tabs)/(manage)');
    } catch (error) {
      console.error('Error adding name: ', error);
      Alert.alert(
        "Error",
        "Failed to create item. Please try again later.",
        [{ text: "OK" }],
        { cancelable: false }
      );
    }
  };

  const handleFinishPress = async () => {
    await addNameToFirestore();
  };

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalStyles.mainBackgroundColor.color}}>
        <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity 
        style={globalStyles.backbutton} 
        onPress={() => router.replace('/(tabs)/(manage)')}
      >
        <MaterialIcons 
          name="close" 
          size={28} 
          color={globalStyles.BlackOrwhite.color} 
        />
      </TouchableOpacity>
      <Text style={{marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Share item</Text>
      <Text style={{ marginTop: 40, marginLeft: 20, marginRight: 40, marginBottom: 20, color: globalStyles.DarkGreyOrLightGrey.color}}>
        Select people below to share this item with
      </Text>
      <ScrollView
        contentContainerStyle={{flexDirection: 'column', marginHorizontal: 20}}
        showsVerticalScrollIndicator={false}
      >
        {associated.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={[
              styles.optionButton, 
              {backgroundColor: globalStyles.LightGreyOrDarkGrey.color},
              selected.includes(item) && {    
                borderColor: globalStyles.brightMainColor.color,
                borderWidth: 2,
                backgroundColor: 'transparent'
              }
            ]}
            onPress={() => toggleSelection(item)}
          >
            <Display email={item} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity 
        style={[styles.nextButton, {backgroundColor: globalStyles.brightMainColor.color}]} 
        onPress={handleFinishPress}
      >
        <Text style={styles.nextButtonText}>Finish</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  optionButton: {width: '100%', height: 80, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', paddingVertical: 15, marginBottom: 10},
  managerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  friendImage: {
    width: 50,
    height: 50,
    borderRadius: 100,
    marginLeft: 15,
  },
  scrollViewWrapper: {
    flex: 1,
    marginTop: 20,
    marginBottom: 80,
  },
  scrollViewContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButtonSelected: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: 'white'
  },
  optionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  nextButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 5,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});


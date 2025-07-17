import getGlobalStyles from '../../../globalStyles';
import React, { useEffect, useState, useCallback } from 'react';
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
  arrayUnion,
  query,
  collection,
  getDocs,
  where
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { app } from '../../../../configs/firebaseConfig';

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

export default function Share() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();

  const [user, setUser] = useState(null);
  const [associated, setAssociated] = useState([]);
  const [selected, setSelected] = useState([]);
  const [alreadySharedWith, setAlreadySharedWith] = useState([]);
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);

  // Listen for auth state changes and fetch the user's associated list and item share data
  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    const authInstance = getAuth(app);
    const db = getFirestore(app);
    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch the associated array from the current user's document
        getDoc(doc(db, 'users', currentUser.uid))
          .then((docSnap) => {
            if (docSnap.exists) {
              setAssociated(docSnap.data().associated || []);
            }
          })
          .catch((error) => console.error('Error fetching associated list:', error));
        if (itemId) {
          // Fetch the sharedWith array from the item document
          getDoc(doc(db, 'items', itemId))
            .then((docSnap) => {
              if (docSnap.exists) {
                setAlreadySharedWith(docSnap.data().sharedWith || []);
              }
            })
            .catch((error) => console.error('Error fetching item data:', error));
        }
      }
    });

    return () => unsubscribe();
  }, [itemId]);

  useEffect(() => {
    setLoading(true);

    const delayPerUser = 100;
    const rawDelay = associated.length * delayPerUser;
    const delay = Math.min(Math.max(rawDelay, 100), 5000);

    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, [associated]);

  // Toggle selection of an associated user if the item isn't already shared with them
  const toggleSelection = (item) => {
    if (alreadySharedWith.includes(item)) {
      Alert.alert('Information', `${item} is already shared with this item.`);
      return;
    }
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  // Update the 'sharedWith' field for the item document with the selected associated users
  const updateSharedWith = async () => {
    if (!user || !itemId) {
      console.error('User is not authenticated or itemId is missing');
      return;
    }
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'items', itemId), {
        sharedWith: arrayUnion(...selected)
      });
      router.replace({ pathname: '/(inspect)/manageUsers', params: { itemId, fromHome } });
    } catch (error) {
      console.error('Error updating sharedWith: ', error);
    }
  };

  const handleFinishPress = async () => {
    await updateSharedWith();
  };

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
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace({ pathname: '/(inspect)/manageUsers', params: { itemId, fromHome } })}
      >
        <MaterialIcons name="close" size={28} color={globalStyles.BlackOrwhite.color} />
      </TouchableOpacity>
      <Text style={{marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Give access to friends</Text>
      <Text style={{ marginTop: 40, marginLeft: 20, marginRight: 40, marginBottom: 20, color: globalStyles.DarkGreyOrLightGrey.color }}>Select who you want to give access to below</Text>
      <ScrollView
        contentContainerStyle={{flexDirection: 'column', marginHorizontal: 20}}
        showsVerticalScrollIndicator={false}
      >
        {associated.length === 0 ? (
          <View style={{alignItems: 'center'}}>
            <Text style={[styles.emptyMessage, { marginTop: '50%', maxWidth: '60%' }]}>
              Add friends back on the 'Friends' tab to share this item with
            </Text>
          </View>
        ) : (
          associated.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton, {backgroundColor: globalStyles.LightGreyOrDarkGrey.color, borderColor: globalStyles.LightGreyOrDarkGrey.color},
                selected.includes(item)
                  ? [styles.optionButtonSelected, {borderColor: globalStyles.brightMainColor.color}]
                  : alreadySharedWith.includes(item)
                  ? styles.optionButtonAlreadyShared
                  : null,
                {opacity: selected.includes(item) ? 1 : alreadySharedWith.includes(item) ? 0.25 : 1}
              ]}
              onPress={() => toggleSelection(item)}
            >
              <Display email={item} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <TouchableOpacity style={[styles.nextButton, {backgroundColor: globalStyles.brightMainColor.color}]} onPress={handleFinishPress}>
        <Text style={styles.nextButtonText}>Finish</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  emptyMessage: {
    fontSize: 13,
    color: '#7d7d7d',
    marginTop: 50,
    marginBottom: 50,
    textAlign: 'center',
  },
  managerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  friendImage: {
    width: 50,
    height: 50,
    borderRadius: 100,
    marginLeft: 13,
  },
  scrollViewWrapper: {
    flex: 1,
    marginTop: 20,
    marginBottom: 80
  },
  scrollViewContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  optionButton: {width: '100%', height: 80, borderRadius: 20, borderWidth: 2, backgroundColor: '#f0f0f0', justifyContent: 'center', paddingVertical: 15, marginBottom: 10},
  optionButtonSelected: {
    borderWidth: 2,
    backgroundColor: 'transparent'
  },
  optionButtonAlreadyShared: {
    backgroundColor: 'grey'
  },
  optionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center'
  },
  nextButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 5
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  }
});
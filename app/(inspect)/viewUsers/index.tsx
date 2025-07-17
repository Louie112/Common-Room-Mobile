import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import {
  getFirestore,
  doc,
  getDoc,
  query,
  collection,
  getDocs,
  where
} from '@react-native-firebase/firestore';

import {
  getAuth,
  onAuthStateChanged
} from '@react-native-firebase/auth';

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

const Display = React.memo(({ email, extraText }) => {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const { givenName, photoURL } = useUserData(email);

  return (
    <View>
      {photoURL === false || givenName === false ? (
        <View
          style={{
            width: '100%',
            height: 80,
            borderRadius: 20,
            backgroundColor: globalStyles.LightGreyOrDarkGrey.color,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 15,
            marginBottom: 10,
          }}
        >
        </View>
      ) : (
        <View
          style={{
            width: '100%',
            height: 80,
            borderRadius: 20,
            backgroundColor: globalStyles.LightGreyOrDarkGrey.color,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 15,
            marginBottom: 10,
          }}
        >
          {photoURL ? (
            <Image
              source={{ uri: photoURL }}
              style={styles.friendImage}
            />
          ) : (
            <MaterialIcons
              name="account-circle"
              size={50}
              color={globalStyles.DarkGreyOrLightGrey.color}
              style={{ marginLeft: 14, marginRight: 1 }}
            />
          )}
          <View
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              marginLeft: 10,
            }}
          >
            <View style={{ flexDirection: 'row' }}>
              <Text style={{ color: globalStyles.BlackOrwhite.color }}>
                {givenName}
                {extraText ? ` ${extraText}` : ''}
              </Text>
            </View>
            <Text
              style={[
                styles.managerText,
                { color: globalStyles.DarkGreyOrLightGrey.color },
              ]}
            >
              {email}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default function viewUsers() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId } = useLocalSearchParams();

  const [user, setUser] = useState(null);
  const [itemName, setItemName] = useState(null);
  const [sharedWith, setSharedWith] = useState([]);
  const [createdBy, setCreatedBy] = useState(null);
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    const authInstance = getAuth(app);
    const db = getFirestore(app);
    const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
      setUser(currentUser);
      if (currentUser && itemId) {
        const itemRef = doc(db, 'items', itemId);
        getDoc(itemRef)
          .then((docSnap) => {
            if (docSnap.exists) {
              const data = docSnap.data();
              setSharedWith(data.sharedWith || []);
              setCreatedBy(data.createdBy || null);
              setItemName(data.name);
            }
          })
          .catch((err) => console.error('Error fetching item details:', err));
      }
    });

    return () => unsubscribe();
  }, [itemId]);

  useEffect(() => {
    setLoading(true);

    const delayPerUser = 250;
    const rawDelay = sharedWith.length * delayPerUser;
    const delay = Math.min(Math.max(rawDelay, 250), 5000);

    const timer = setTimeout(() => setLoading(false), delay);
    return () => clearTimeout(timer);
  }, [sharedWith]);

  const handlePress = (userEmail) => {
    router.push({
      pathname: '/(profileInspect)',
      params: { userEmail }
    });
  };

  const filteredSharedWith = sharedWith.filter(email => email !== user?.email);

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
      <TouchableOpacity style={styles.backButton} onPress={router.back}>
        <MaterialIcons
          name="arrow-back"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      <Text style={[{fontSize: 25, marginTop: 100, marginLeft: 20, color: globalStyles.BlackOrwhite.color}]}>People with access</Text>
      <Text style={{ marginTop: 20, marginLeft: 20, marginRight: 40, marginBottom: 40, color: globalStyles.DarkGreyOrLightGrey.color }}>These people can view and reserve {itemName}</Text>
      <ScrollView
        contentContainerStyle={{flexDirection: 'column', marginHorizontal: 20}}
        showsVerticalScrollIndicator={false}
      >
        {createdBy && (
          <View style={{width: '100%', height: 80, borderRadius: 20, backgroundColor: globalStyles.LightGreyOrDarkGrey.color, marginBottom: 10}}>
            <TouchableOpacity style={{justifyContent: 'center'}}  onPress={() => handlePress(createdBy)}>
              <Display email={createdBy} extraText='(Manger)'/>
            </TouchableOpacity>
          </View>
        )}
        {user && (
          <Display email={user.email} extraText='(You)'/>
        )}
        {filteredSharedWith.map((item, index) => (
          <View key={index} style={{width: '100%', height: 80, borderRadius: 20, backgroundColor: globalStyles.LightGreyOrDarkGrey.color, marginBottom: 10}}>
            <TouchableOpacity style={{justifyContent: 'center'}}  onPress={() => handlePress(item)}>
              <Display email={item}/>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
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
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    position: 'relative',
    marginBottom: 40,
  },
  managerButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 100,
    width: 130,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10,
    position: 'relative',
    marginBottom: 40,
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
    position: 'relative',
    marginBottom: 40,
  },
  optionText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  managerText: {
    fontSize: 12,
    color: 'grey',
    textAlign: 'center',
  },
  currentUserText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: 140,
  },
  removeButtonText: {
    color: '#ff0000',
    fontWeight: 'bold',
  },
  shareButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    elevation: 5,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

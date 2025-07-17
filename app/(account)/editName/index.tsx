import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
} from '@react-native-firebase/firestore';
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { app } from '../../../configs/firebaseConfig';

export default function Account() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [nameInput, setNameInput] = useState('');

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
  
  useEffect(() => {
    if (name) {
      setNameInput(name);
    }
  }, [name]);

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
          setUrl(photoUrl);
          setName(userName);
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

  // Function that updates the user's display name (givenName) in Firestore
  const handleUpdateName = async () => {
    if (!nameInput.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }
    try {
      const db = getFirestore(app);
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { givenName: nameInput });
      setNameInput('');
      router.back();
    } catch (error) {
      console.error('Error updating display name: ', error);
      Alert.alert('Error', 'Failed to update display name');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity style={styles.backButton} onPress={router.back}>
        <MaterialIcons
          name="close"
          size={28}
          color={globalStyles.BlackOrwhite.color}
        />
      </TouchableOpacity>
      <Text style={{marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Edit display name</Text>
      <Text style={{ marginTop: 20, marginLeft: 20, marginRight: 40, color: globalStyles.DarkGreyOrLightGrey.color }}>Change the name people will see for you</Text>
      <View style={{marginHorizontal: 20, marginTop: 20}}>
        <TextInput
          style={[styles.input, {color: globalStyles.BlackOrwhite.color}]}
          placeholder="Type new item name here..."
          placeholderTextColor={globalStyles.DarkGreyOrLightGrey.color}
          value={nameInput}
          onChangeText={setNameInput}
          autoFocus={true}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '100%',
          marginTop: 20
        }}
      >
        <TouchableOpacity style={{marginBottom: 10}} onPress={router.back}>
          <Text style={[styles.buttonText, { color: globalStyles.mainColor.color}]}>
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: globalStyles.mainColor.color,
              marginLeft: 20,
              paddingVertical: 10,
              alignItems: 'center',
              width: 80,
              marginRight: 20,
            },
          ]}

          onPress={handleUpdateName} disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.buttonText, { color: 'white'}]}>
                Save
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonText: {
    color: 'white',
    fontSize: 15,
  },
  button: {  
    borderRadius: 50,        
    paddingVertical: 10,      
    alignItems: 'center',     
    justifyContent: 'center', 
    marginBottom: 10,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 25,
    backgroundColor: '#4CAF50',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    color: 'white',
    marginLeft: 10,
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    height: 60,
    width: '100%',
    borderWidth: 1,
    borderColor: 'grey',
    paddingHorizontal: 15,
    fontSize: 20,
    borderRadius: 5
  },
});

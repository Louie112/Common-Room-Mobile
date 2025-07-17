import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
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
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { app } from '../../../configs/firebaseConfig';

export default function EditProfilePic() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(true);

  const [nameInput, setNameInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [photoRemoved, setPhotoRemoved] = useState(false);

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

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        'Permission required',
        'Permission to access your photo library is required!'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });

    if (pickerResult.canceled) {
      return;
    }

    const selectedAsset = pickerResult.assets && pickerResult.assets[0];
    if (!selectedAsset) {
      console.warn('No image asset found.');
      return;
    }
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        selectedAsset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setSelectedImage(manipResult.uri);
      // Reset the photoRemoved flag because a new image is picked
      setPhotoRemoved(false);
    } catch (error) {
      console.error('Image Manipulation Error', error);
    }
  };


const uploadImage = async (uri) => {
  if (!uri || !user) {
    console.log("URI or User Missing");
    return null;
  }
  try {
    const filename = uri.substring(uri.lastIndexOf('/') + 1);
    const reference = storage().ref(`profileImages/${user.uid}/${filename}`);
    await reference.putFile(uri);
    const downloadURL = await reference.getDownloadURL();
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image: ', error);
    return null;
  }
};

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const db = getFirestore(app);
      let newPhotoURL = url;
      // If a new image was picked, upload it
      if (selectedImage) {
        const uploadedUrl = await uploadImage(selectedImage);
        if (uploadedUrl) {
          newPhotoURL = uploadedUrl;
        } else {
          Alert.alert('Upload failed', 'There was a problem uploading the image.');
          setLoading(false);
          return;
        }
      }
      // If the photo was removed, update with an empty string
      else if (photoRemoved) {
        newPhotoURL = '';
      }
      
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: newPhotoURL,
        givenName: nameInput,
      });
      router.back();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Update Error', 'Something went wrong while updating the item.');
    }
  };
  

  const handleRemovePhoto = () => {
    setSelectedImage(null);
    setPhotoRemoved(true);
  };

  const isRemoveDisabled = !selectedImage && !photoRemoved && !url;

  if (loading) {
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

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <TouchableOpacity style={styles.backButton} onPress={router.back}>
        <MaterialIcons name="close" size={28} color={globalStyles.BlackOrwhite.color} />
      </TouchableOpacity>
      <Text style={{ marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color }}>
        Change profile picture
      </Text>
      <Text
        style={{
          marginTop: 20,
          marginLeft: 20,
          marginRight: 40,
          color: globalStyles.DarkGreyOrLightGrey.color,
          marginBottom: 40,
        }}
      >
        Change the picture that others will see for you
      </Text>
      <View style={styles.fullModalContent}>
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={pickImage}
          disabled={uploading}
        >
          {uploading ? (
            <View style={[styles.profileImage, styles.placeholder]}>
              <ActivityIndicator size="large" color={globalStyles.mainColor.color} />
            </View>
          ) : selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.profileImage} />
          ) : (!photoRemoved && url) ? (
            <Image source={{ uri: url }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholder, {backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}>
              <MaterialIcons name="person" size={100} color={globalStyles.DarkGreyOrLightGrey.color} />
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '100%',
          marginTop: 0,
        }}
      >
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor: globalStyles.mainColor.color,
              paddingVertical: 10,
              alignItems: 'center',
              marginLeft: 20,
              marginRight: 10,
              flex: 1,
            },
          ]}
          onPress={pickImage}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={globalStyles.WhiteOrBlack.color} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="edit" size={20} color={globalStyles.WhiteOrBlack.color} />
              <Text style={[styles.buttonText, { color: globalStyles.WhiteOrBlack.color }]}>Change</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            {
              backgroundColor:
                selectedImage || photoRemoved || url ? globalStyles.mainColor.color : globalStyles.LightGreyOrDarkGrey.color,
              paddingVertical: 10,
              alignItems: 'center',
              marginRight: 20,
              marginLeft: 10,
              flex: 1,
            },
          ]}
          onPress={
            selectedImage || photoRemoved ? handleUpdateProfile : handleRemovePhoto
          }
          disabled={loading || isRemoveDisabled}
        >
          {loading ? (
            <ActivityIndicator size="small" color={globalStyles.WhiteOrBlack.color} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {selectedImage || photoRemoved ? (
                <>
                  <MaterialIcons name="save" size={19} color={globalStyles.WhiteOrBlack.color} />
                  <Text style={[styles.buttonText, { color: globalStyles.WhiteOrBlack.color }]}>Save</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="delete" size={19} color={globalStyles.WhiteOrBlack.color} />
                  <Text style={[styles.buttonText, { color: globalStyles.WhiteOrBlack.color }]}>Remove</Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileImage: {
    width: 250,
    height: 250,
    borderRadius: 200,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
  button: {  
    borderRadius: 50,        
    height: 40,      
    alignItems: 'center',     
    justifyContent: 'center', 
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 14,
    marginLeft: 5,
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
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fullModalContent: {
    padding: 0,
    marginBottom: 10
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholder: {
    backgroundColor: '#e1e1e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    marginTop: 10,
    color: '#4CAF50',
    fontSize: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
});
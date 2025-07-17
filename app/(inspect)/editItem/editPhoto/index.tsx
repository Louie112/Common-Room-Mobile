import getGlobalStyles from '../../../globalStyles';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
} from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { app } from '../../../../configs/firebaseConfig';

export default function EditPhoto() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();
  const [url, setUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    if (itemId) {
      fetchUrl(itemId); // Fetch item details including photoURL
    }
  }, [itemId]);

  const fetchUrl = (itemId) => {
    if (!itemId) return;
    setLoading(true);
    try {
      const db = getFirestore(app);
      const itemDocRef = doc(db, 'items', itemId);
      const unsubscribe = onSnapshot(itemDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const itemData = docSnapshot.data();
          const photoUrl = itemData.photoURL || '';
          setUrl(photoUrl);
        } else {
          setUrl('');
        }
        setLoading(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching URL:', error);
      setLoading(false);
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
    // Resize the image
    try {
      setLoadingImage(true);
      const manipResult = await ImageManipulator.manipulateAsync(
        selectedAsset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setSelectedImage(manipResult.uri);
      // Reset the photoRemoved flag because a new image is picked
      setPhotoRemoved(false);
      setLoadingImage(false);
    } catch (error) {
      console.error('Image Manipulation Error', error);
    }
  };

  const uploadImage = async (uri) => {
    if (!uri || !itemId) {
      console.log('URI or itemId missing');
      return null;
    }
    try {
      const filename = uri.substring(uri.lastIndexOf('/') + 1);
      const storageRef = storage().ref(`itemImages/${itemId}/${filename}`);
      const response = await fetch(uri);
      const blob = await response.blob();
      await storageRef.put(blob);
      const downloadURL = await storageRef.getDownloadURL();
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleUpdateProfile = async () => {
    if (!itemId) {
      console.warn('Missing itemId');
      return;
    }
    setLoading(true);
    try {
      let newPhotoURL = url;

      if (selectedImage) {
        const uploadedUrl = await uploadImage(selectedImage);
        if (!uploadedUrl) throw new Error('Upload failed');
        newPhotoURL = uploadedUrl;
      } else if (photoRemoved) {
        newPhotoURL = '';
      }

      await updateDoc(doc(getFirestore(app), 'items', itemId), {
        photoURL: newPhotoURL,
      });
      router.replace({ pathname: '/(inspect)', params: { itemId, fromHome } });
    } catch (error) {
      console.error(error);
      Alert.alert('Save Error', error.message || 'Unknown error');
      setLoading(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedImage(null);
    setPhotoRemoved(true);
  };

  // Determine if there's an image available to remove, either the current image from Firestore or a newly selected one
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
        Change item picture
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
        Change the picture people will see for this item
      </Text>
      <View style={styles.fullModalContent}>
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={pickImage}
        >
          {loadingImage ? (
            <View style={[styles.profileImage, styles.placeholder]}>
              <ActivityIndicator size="large" color={globalStyles.mainColor.color} />
            </View>
          ) : selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.profileImage} />
          ) : (!photoRemoved && url) ? (
            <Image source={{ uri: url }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.placeholder, {backgroundColor: globalStyles.LightGreyOrDarkGrey.color}]}>
              <MaterialIcons name="image" size={50} color={globalStyles.DarkGreyOrLightGrey.color} />
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
        {/* Left button "Change" always allows selecting a new image */}
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
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="edit" size={20} color={globalStyles.WhiteOrBlack.color} />
            <Text style={[styles.buttonText, { color: globalStyles.WhiteOrBlack.color }]}>Change</Text>
          </View>
        </TouchableOpacity>

        {/* Right Button:
            - Shows "Save" if a new image is picked or if the photo was removed.
            - Otherwise, shows "Remove" disabled if there's no image to remove. */}
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
        </TouchableOpacity>
      </View>
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
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileImage: {
    width: '100%',
    height: 180,
    borderRadius: 10
  },
  placeholder: {
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

import getGlobalStyles from '../../../globalStyles';
import React, { useEffect, useState } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  TextInput,
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
import { app } from '../../../../configs/firebaseConfig';

export default function EditName() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    if (itemId) {
      fetchUrl(itemId); // Fetch from items collection
    }
  }, [itemId]);

  useEffect(() => {
    if (name) {
      setNameInput(name);
    }
  }, [name]);

  const fetchUrl = (itemId) => {
    if (!itemId) return;
    setLoadingUrl(true);
    try {
      const db = getFirestore(app);
      const itemDocRef = doc(db, 'items', itemId); // Reference to 'items' collection
      const unsubscribe = onSnapshot(itemDocRef, (docSnapshot) => {
        if (docSnapshot && docSnapshot.exists) {
          const itemData = docSnapshot.data();
          const itemName = itemData.name || '';
          setName(itemName);
        } else {
          setName('');
        }
        setLoadingUrl(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching URL:', error);
      setLoadingUrl(false);
    }
  };

  const handleUpdateProfile = async () => {
    console.log("Save button pressed");
    if (!itemId) {
      console.warn("Missing itemId");
      return;
    }
    setLoading(true);
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'items', itemId), { // Update 'items' collection
        name: nameInput, // Update the item "name" field
      });
      router.back();
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Update Error', 'Something went wrong while updating the item.');
    } finally {
      setLoading(false);
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
      <Text style={{marginTop: 100, marginLeft: 20, fontSize: 25, color: globalStyles.BlackOrwhite.color}}>Change item name</Text>
      <Text style={{ marginTop: 20, marginLeft: 20, marginRight: 40, color: globalStyles.DarkGreyOrLightGrey.color }}>Change the name people will see for this item</Text>
      <View style={{marginHorizontal: 20, marginTop: 20}}>
        <TextInput
          style={[styles.input, {color: globalStyles.BlackOrwhite.color}]}
          placeholder="Type new item name here..."
          placeholderTextColor={globalStyles.DarkGreyOrLightGrey.color}
          value={nameInput}
          onChangeText={(text) => setNameInput(text)}
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

          onPress={handleUpdateProfile} disabled={loading}
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
    fontWeight: 600
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
  saveText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
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

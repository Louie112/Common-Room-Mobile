import getGlobalStyles from '../../globalStyles';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  getFirestore,
  doc,
  onSnapshot,
  getDoc,
  writeBatch,
  collection,
  deleteDoc,
  getDocs,
  query,
  where,
  arrayRemove,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { app } from '../../../configs/firebaseConfig';

export default function EditItem() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const { itemId, fromHome } = useLocalSearchParams();

  const [name, setName] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(true);

  const authInstance = getAuth(app);
  const currentUser = authInstance.currentUser;
  const isFocused = useIsFocused();

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace({
          pathname: '/(inspect)',
          params: { itemId, fromHome },
        });
        return true;  
      };

      // addEventListener now returns a subscription
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      // cleanup by calling subscription.remove()
      return () => subscription.remove();
    }, [router, itemId, fromHome])
  );

  useEffect(() => {
    if (!isFocused || !itemId) {
      return;
    }
    if (itemId) {
      fetchUrl(itemId); // Fetch from items collection
    }
  }, [itemId]);

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

  const handleDeleteItem = async () => {
    if (!itemId || !currentUser) return;
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: confirmDeleteItem },
    ]);
  };

  const confirmDeleteItem = async () => {
    if (!itemId || !currentUser) {
      console.error('Missing itemId, itemDetails, or currentUser for deletion.');
      return;
    }
  
    try {
      const db = getFirestore(app);
      const itemRef = doc(db, 'items', itemId);
      const itemSnapshot = await getDoc(itemRef);
  
      if (!itemSnapshot.exists) {
        console.error('Item not found for deletion.');
        return;
      }
  
      const itemData = itemSnapshot.data();
      const sharedWith = itemData.sharedWith || [];
  
      const batch = writeBatch(db);
  
      // Remove the item from each user's favorites.
      for (const userEmail of sharedWith) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', userEmail));
        const userQuerySnapshot = await getDocs(q);
        if (!userQuerySnapshot.empty) {
          const userDoc = userQuerySnapshot.docs[0];
          batch.update(userDoc.ref, {
            favorites: arrayRemove(itemId),
          });
        }
      }
  
      // Remove from current user's favorites as well.
      const currentUserDocRef = doc(db, 'users', currentUser.uid);
      const currentUserDoc = await getDoc(currentUserDocRef);
      if (currentUserDoc.exists) {
        batch.update(currentUserDocRef, {
          favorites: arrayRemove(itemId),
        });
      }
  
      await batch.commit();
      await deleteDoc(itemRef);
      router.replace('/(tabs)/(manage)');
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <View style={{flexDirection: 'row', marginTop: 40, marginBottom: 60, alignItems: 'center', marginLeft: 20}}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons
            name="arrow-back"
            size={28}
            color={globalStyles.BlackOrwhite.color}
          />
        </TouchableOpacity>
        <Text style={{fontSize: 22, textAlign: 'left',color: globalStyles.BlackOrwhite.color, marginLeft: 15}}>
          Edit item
        </Text>
      </View>

      <TouchableOpacity
        style={styles.textButton}
        onPress={() => {
          router.push({ pathname: '/(inspect)/editItem/editPhoto', params: { itemId, fromHome } })
        }}
      >
        <MaterialIcons
          name="photo"
          size={25}
          color={globalStyles.BlackOrwhite.color}
        />
        <View style={styles.textInside}>
          <Text style={[{ fontSize: 17, marginLeft: 15, marginBottom: 2, color: globalStyles.BlackOrwhite.color }]}>
            Picture
          </Text>
          <Text style={[{ fontSize: 15, marginLeft: 15, color: globalStyles.DarkGreyOrLightGrey.color }]}>
            Choose the picture others see
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.textButton}
        onPress={() => {
          router.push({ pathname: '/(inspect)/editItem/editName', params: { itemId, fromHome } })
        }}
      >
        <MaterialIcons
          name="badge"
          size={25}
          color={colorScheme === 'dark' ? 'white' : 'black'}
        />
        <View style={styles.textInside}>
          <Text style={[{ fontSize: 17, marginLeft: 15, marginBottom: 2, color: globalStyles.BlackOrwhite.color }]}>
            Name
          </Text>
          <Text style={[{ fontSize: 15, marginLeft: 15, color: globalStyles.DarkGreyOrLightGrey.color, maxWidth: '90%' }]} numberOfLines={1} ellipsizeMode='tail'>
            {name}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={{marginLeft: 20, marginTop: 20, width: 100}} onPress={handleDeleteItem}>
        <Text style={[{ color: 'red', fontSize: 17 }]}>Delete item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  textButton: {
    width: '100%',
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 20,
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
  header: {
    paddingTop: 100,
    marginLeft: 20,
    marginBottom: 100,
  },
  headerText: {
    fontSize: 29,
    textAlign: 'left',
    color: '#4CAF50',
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
    borderRadius: 10,
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

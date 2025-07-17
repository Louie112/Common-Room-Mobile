import React, { useState } from 'react';
import getGlobalStyles from '../globalStyles';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { app } from '../../configs/firebaseConfig';

export default function FriendSearch() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);

  const [searchQuery, setSearchQuery] = useState('');
  const [noUserFound, setNoUserFound] = useState(false);
  const currentUser = getAuth(app).currentUser; // Get the current logged-in user

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery === '') {
      setNoUserFound(false);
      return;
    }
    try {
      const db = getFirestore(app);
      const usersRef = collection(db, 'users');
      // Query for an exact email match
      const q = query(usersRef, where('email', '==', trimmedQuery));
      const querySnapshot = await getDocs(q);

      // Check if a user is found and not the current user
      if (querySnapshot.empty || (currentUser && trimmedQuery === currentUser.email)) {
        setNoUserFound(true);
      } else {
        setNoUserFound(false);
        // Navigate using the email typed since a match was found
        router.push({
          pathname: '/(profileInspect)',
          params: { userEmail: trimmedQuery },
        });
      }
    } catch (error) {
      console.error('Error fetching user email:', error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <View style={{flexDirection: 'row', marginTop: 40, alignItems: 'center', marginLeft: 20}}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons
            name="arrow-back"
            size={28}
            color={globalStyles.BlackOrwhite.color}
          />
        </TouchableOpacity>
        <Text style={{fontSize: 22, textAlign: 'left',color: globalStyles.BlackOrwhite.color, marginLeft: 15}}>
          Add friends
        </Text>
      </View>
      <View style={{position: 'absolute', left: 36, top: 98, backgroundColor: globalStyles.mainBackgroundColor.color, zIndex: 100, paddingHorizontal: 5}}>
        <Text style={{color: globalStyles.BlackOrwhite.color}}>User email</Text>
      </View>
      <View style={{flexDirection: 'column', alignItems: 'flex-end', marginHorizontal: 20}}>
        <TextInput
          style={[styles.searchBar, {color: globalStyles.BlackOrwhite.color}]}
          placeholder="Enter user email to search..."
          placeholderTextColor={globalStyles.DarkGreyOrLightGrey.color}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setNoUserFound(false); // Reset error as the user types
          }}
          onSubmitEditing={handleSearch} // Trigger search when "Done" is pressed
          returnKeyType="done"
        />
        <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{fontWeight: 600, color: globalStyles.mainColor.color}}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSearch} style={[styles.searchButton, {backgroundColor: globalStyles.mainColor.color}]}>
            <MaterialIcons
              name="search"
              size={20}
              color={'white'}
            />
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>
      {noUserFound && (
        <Text style={styles.noSharedWithText}>
          No users found with that email
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
  },
  searchBar: {
    height: 55,
    borderColor: '#ccc',
    borderWidth: 1,
    paddingLeft: 20,
    marginTop: 40,
    borderRadius: 150,
    width: '100%'
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    height: 40,
    width: 100,
    borderRadius: 50,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginLeft: 20
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 600,
    marginLeft: 5,
  },
  noSharedWithText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 40,
  },
});


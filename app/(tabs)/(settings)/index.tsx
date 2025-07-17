import getGlobalStyles from '../../../app/globalStyles';
import React from 'react';
import { 
  Text, 
  View, 
  BackHandler, 
  useColorScheme, 
  TouchableOpacity, 
  StyleSheet, 
  Alert 
} from 'react-native';
import { getAuth, signOut } from '@react-native-firebase/auth';
import { app } from '../../../configs/firebaseConfig';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getFirestore,
  doc,
  updateDoc
} from '@react-native-firebase/firestore';

export default function Settings() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();

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

  const handleSignOut = async () => {
    const authInstance = getAuth(app);
    const firestoreDB = getFirestore(app);
    try {
      // Retrieve the current user before signing out
      const user = authInstance.currentUser;
      if (user) {
        // Create a reference to the user's document in the "notifications" collection
        const notifDocRef = doc(firestoreDB, "notifications", user.uid);
        // Set the fcmPushToken field to an empty string
        await updateDoc(notifDocRef, { fcmPushToken: "" });
      }
      
      // After updating the document, sign out the user
      await signOut(authInstance);
      console.log("User signed out!");
      router.replace("/(backup)");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };
  

  const confirmSignOut = () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", onPress: () => console.log("Sign out cancelled"), style: "cancel" },
        { text: "Sign Out", onPress: () => handleSignOut() }
      ],
      { cancelable: true }
    );
  };

  const handleAccount = () => {
    router.push('/(account)');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: globalStyles.mainBackgroundColor.color, padding: 20 }}>
      <View style={{flex:1, justifyContent: 'flex-start'}}>
        <TouchableOpacity style={styles.textButton} onPress={handleAccount}>
          <MaterialIcons
            name="account-circle"
            size={30}
            color={colorScheme === 'dark' ? 'white' : 'black'}
          />
          <View style={styles.textInside}>
            <Text style={[{ fontSize: 17 }, { marginLeft: 15 }, { marginBottom: 2, color: globalStyles.BlackOrwhite.color }]}>Account</Text>
            <Text style={[{ fontSize: 15 }, { marginLeft: 15 }, { color: globalStyles.DarkGreyOrLightGrey.color }]}>Display name, profile picture</Text>
          </View>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: 'transparent' },
          { borderWidth: 1 },
          { borderColor: globalStyles.mainColor.color },
        ]}
        onPress={confirmSignOut} 
      >
        <Text style={[styles.buttonText, { color: globalStyles.mainColor.color }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  textInside: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start'
  },
  button: {
    width: '100%',
    borderRadius: 50,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  textButton: {
    width: '100%',
    paddingVertical: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

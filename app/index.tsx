import getGlobalStyles from './globalStyles';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  useColorScheme,
  StyleSheet,
  Image,
  BackHandler,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

import { app } from '../configs/firebaseConfig';

import {
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  GoogleAuthProvider,
} from '@react-native-firebase/auth';

import {
  getFirestore,
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

GoogleSignin.configure({
  webClientId:
    '172287347189-oejmntqjp9un2allscg2b0a837e3t73u.apps.googleusercontent.com',
});

const CustomGoogleSignInButton = ({ onPress }) => {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  return (
    <TouchableOpacity style={[styles.button, {backgroundColor: globalStyles.WhiteOrDarkGrey.color}]} onPress={onPress}>
      <View style={styles.content}>
        <Image
          source={require('../assets/images/googleLogo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.text, {color: globalStyles.DarkGreyOrLightGrey.color}]}>  Sign in with Google</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function Welcome() {
  const colorScheme = useColorScheme();
  const globalStyles = getGlobalStyles(colorScheme);
  const router = useRouter();
  const isFocused = useIsFocused();

  const [initializing, setInitializing] = useState(true);
  const [googleButtonLoading, setGoogleButtonLoading] = useState(false);
  const [user, setUser] = useState(null);

  const handleAuthStateChanged = (user) => {
    setUser(user);
    if (initializing) setInitializing(false);
  };

  useEffect(() => {
    const authInstance = getAuth(app);
    const unsubscribe = onAuthStateChanged(authInstance, handleAuthStateChanged);

    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, [isFocused]);

  // Navigate to home when user is signed in
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)/(home)');
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log(
        'Google Sign In response:',
        JSON.stringify(userInfo, null, 2)
      );
  
      // Extract the idToken from the returned user info.
      const token = userInfo?.idToken || userInfo?.data?.idToken;
      if (!token) {
        return;
      }
  
      // Create a Google credential and sign in
      const googleCredential = GoogleAuthProvider.credential(token);
      const authInstance = getAuth(app);
      const userCredential = await signInWithCredential(
        authInstance,
        googleCredential
      );
      console.log('Google sign in successful!');
  
      // Check Firestore using a query based on the user's email.
      const db = getFirestore(app);
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('email', '==', userCredential.user.email),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
  
      if (querySnapshot.empty) {
        // If no matching user document exists, add the user.
        const givenName =
          userCredential.additionalUserInfo?.profile?.given_name ||
          userCredential.user.displayName ||
          '';
        const photoURL =
          userCredential.user.photoURL ||
          userCredential.additionalUserInfo?.profile?.picture ||
          null;
        // Using the UID as the document id
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userDocRef, {
          email: userCredential.user.email,
          givenName,
          photoURL,
          createdAt: serverTimestamp(),
          associated: [],
          requestedBy: [],
          favourites: [],
          welcome: true,
          welcome2: true,
          welcome3: true,
          welcome4: true,
          welcome5: true,
          welcome6: true,
          welcome7: true,
          firstItemYet: false,
          noFriendsVisible: false,
        });
        console.log('New user added to Firestore with profile photo');
      }
    } catch (error) {
      if (
        error.code === statusCodes.SIGN_IN_CANCELLED ||
        error.code === statusCodes.SIGN_IN_REQUIRED
      ) {
        return; // Exit early when cancellation is detected.
      }
      console.error('Google sign in error:', error);
    }
  };
  
  const handleChooseDifferentAccount = async () => {
    try {
      setGoogleButtonLoading(true);
      const currentUserGoogle = await GoogleSignin.getCurrentUser();
      if (currentUserGoogle) {
        // If there's a user, revoke access first.
        await GoogleSignin.revokeAccess();
      }
      await handleGoogleSignIn();
      setGoogleButtonLoading(false);
    } catch (error) {
      setGoogleButtonLoading(false);
      if (
        error.code === statusCodes.SIGN_IN_CANCELLED ||
        error.code === statusCodes.SIGN_IN_REQUIRED
      ) {
        return;
      }
      console.error('Error choosing different account:', error);
    }
  };

  if (initializing) {
    return (
      <View
        style={[
          { flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color },
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <View style={styles.loadingContainer}>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('../assets/images/newicon.png')}
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={{ color: globalStyles.mainColor.color, fontSize: 30, fontWeight: 600, position: 'absolute', top: 40, left: 20 }}>
          Welcome
        </Text>
        {googleButtonLoading ? (
          <ActivityIndicator size={40} color={globalStyles.mainColor.color} />
        ) : (
          <CustomGoogleSignInButton onPress={handleChooseDifferentAccount}/>
        )}
        <Text style={{ color: globalStyles.mainColor.color, fontSize: 25, fontWeight: 600, position: 'absolute', bottom: 60, alignSelf: 'center'}}>
          Common Room
        </Text>
        <Text style={{ color: globalStyles.mainColor.color, fontSize: 15, position: 'absolute', bottom: 30, alignSelf: 'center'}}>
          A communal sharing platform
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: globalStyles.mainBackgroundColor.color }}>
      <View style={styles.loadingContainer}>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 200,
    height: 200,
    borderRadius: 60,
    marginBottom: 150,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 5,
    width: 220,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
});
import { initializeApp, getApps, getApp } from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: 'redacted',
  authDomain: 'redacted',
  projectId: 'redacted',
  storageBucket: 'redacted',
  messagingSenderId: 'redacted',
  appId: 'redacted',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };

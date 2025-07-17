import { initializeApp, getApps, getApp } from '@react-native-firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyA5rMibKDXf-z47NclGzN8Os8llRQdY64Q',
  authDomain: 'louiepersonalfirebase.firebaseapp.com',
  projectId: 'louiepersonalfirebase',
  storageBucket: 'louiepersonalfirebase.appspot.com',
  messagingSenderId: '172287347189',
  appId: '1:172287347189:android:d287e5a0e5dddb8355f8bc',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };

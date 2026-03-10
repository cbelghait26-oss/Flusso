// src/services/firebase.ts
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA-FZHnU0MCw43xRhFl7JlFy3ebOMMOrJo",
  authDomain: "flusso-app.firebaseapp.com",
  projectId: "flusso-app",
  storageBucket: "flusso-app.firebasestorage.app",
  messagingSenderId: "402208533063",
  appId: "1:402208533063:web:22ec28ed2e2dec70251f62",
  measurementId: "G-4LVSHR0WVE"
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Initialize Firestore with settings for React Native
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // Required for React Native
});

export { auth, db };

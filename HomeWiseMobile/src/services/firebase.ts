import { initializeApp, getApps, getApp } from "firebase/app";
// Metro resolves Firebase's native export; its default TypeScript declarations omit this helper.
// @ts-expect-error getReactNativePersistence is exported by the React Native Firebase entry.
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyArdNHN_NkjKYtqo2M0_t5Rg1ot6_lBO38",
  authDomain: "homewise-65bb1.firebaseapp.com",
  projectId: "homewise-65bb1",
  storageBucket: "homewise-65bb1.firebasestorage.app",
  messagingSenderId: "1038567423475",
  appId: "1:1038567423475:web:b07801fb6f742604526686",
  measurementId: "G-2F2LDCFJHQ"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : (() => {
      try {
        return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
      } catch (error) {
        if ((error as { code?: string }).code === 'auth/already-initialized') return getAuth(app);
        throw error;
      }
    })();
export const db = getFirestore(app);
export default app;


import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuracao do projeto Firebase do HomeWise
const firebaseConfig = {
  apiKey: "AIzaSyArdNHN_NkjKYtqo2M0_t5Rg1ot6_lBO38",
  authDomain: "homewise-65bb1.firebaseapp.com",
  projectId: "homewise-65bb1",
  storageBucket: "homewise-65bb1.firebasestorage.app",
  messagingSenderId: "1038567423475",
  appId: "1:1038567423475:web:b07801fb6f742604526686",
  measurementId: "G-2F2LDCFJHQ"
};

// Evita inicializar o app multiplas vezes no React Native
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;


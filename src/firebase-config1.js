import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

const firebaseConfig1 = {
  apiKey: "AIzaSyA8UFT6bCG3n-Ib9-72D7hpr8onPekWZRY",
  authDomain: "authentication-tutorial-553a4.firebaseapp.com",
  projectId: "authentication-tutorial-553a4",
  storageBucket: "authentication-tutorial-553a4.firebasestorage.app",
  messagingSenderId: "734261113949",
  appId: "1:734261113949:web:d446c0966ba887cb0949b4",
  measurementId: "G-V0S2RRX7B3"
};

const app = initializeApp(firebaseConfig1);

export const auth = getAuth(app);

export const db = getFirestore(app);
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyB1jsQZ9j9aedw-4-JNmirzRQ1J0Yreffg",
  authDomain: "gestiontesisunfv-26d58.firebaseapp.com",
  projectId: "gestiontesisunfv-26d58",
  storageBucket: "gestiontesisunfv-26d58.appspot.com",
  messagingSenderId: "51208434732",
  appId: "1:51208434732:web:9fb56528ff72d8b9050d89"
};

// Initialize Firebase, ensuring it's only done once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

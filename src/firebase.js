// Firebase initialization for Tax Diary.
//
// This config is safe to have visible in client-side code — unlike the
// Gemini API key (which had to stay server-side in api/scan-receipt.js),
// Firebase's web config is meant to be public. It identifies *which*
// Firebase project to talk to; it isn't a secret credential on its own.
// Real access control comes from Firebase Auth + Firestore Security Rules
// (Stage B), not from hiding this object.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAso-6uelgaZNrZ_p-vP4LHtI_iGw23TFk",
  authDomain: "tax-diary-10fbe.firebaseapp.com",
  projectId: "tax-diary-10fbe",
  storageBucket: "tax-diary-10fbe.firebasestorage.app",
  messagingSenderId: "800654936435",
  appId: "1:800654936435:web:9539ea83dde5686a369d06",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

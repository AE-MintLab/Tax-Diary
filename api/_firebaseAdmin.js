// Firebase Admin SDK — used only inside /api serverless functions.
//
// This is fundamentally different from src/firebase.js: that file uses the
// public client SDK, restricted by Firestore Security Rules (a user can only
// read/write their OWN data). This file uses a service account key with FULL
// admin access, bypassing security rules entirely. That's intentional and
// necessary — a payment webhook isn't "signed in" as any particular user, so
// it needs elevated access to credit the right account. It's also exactly
// why FIREBASE_SERVICE_ACCOUNT_JSON must only ever live in Vercel's
// environment variables, never in the GitHub repo or client-side code.
import admin from "firebase-admin";

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in Vercel Environment Variables.");
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

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

let initError = null;

if (!admin.apps.length) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set in Vercel Environment Variables.");
    }
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (err) {
    // Deliberately NOT re-thrown here — throwing at module load time crashes
    // the entire function before its own try/catch ever runs, which is what
    // caused the opaque "A server error..." (non-JSON) crash page instead of
    // a real error message. Storing it and surfacing it lazily below means
    // every handler's own try/catch can catch this like any normal error and
    // return a clean, readable JSON response instead.
    initError = err;
    console.error("[_firebaseAdmin] Initialization failed:", err.message);
  }
}

function assertReady() {
  if (initError) {
    throw new Error(`Firebase Admin failed to initialize: ${initError.message}`);
  }
}

export function getAdminAuth() {
  assertReady();
  return admin.auth();
}
export function getAdminDb() {
  assertReady();
  return admin.firestore();
}

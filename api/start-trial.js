// Vercel Serverless Function — starts the 7-day Plus trial, server-side.
//
// Trial status used to live in local device storage, which meant signing
// out and back in reset it — anyone could get unlimited fresh trials just
// by doing that. Moving it here, gated by a real Firebase ID token and
// checked against Firestore (not the client's own claim), closes that
// loophole the same way redeem-code.js and create-payment.js already do
// for codes and real payments.
import { adminAuth, adminDb } from "./_firebaseAdmin.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    console.error("[start-trial] Invalid ID token:", err);
    return res.status(401).json({ error: "Your session has expired — please sign in again." });
  }
  const uid = decoded.uid;

  try {
    const billingRef = adminDb.doc(`users/${uid}/private/billing`);
    const snap = await billingRef.get();
    const existing = snap.exists ? snap.data() : {};

    if (existing.trialUsed) {
      console.warn(`[start-trial] uid=${uid} attempted a second trial — already used`);
      return res.status(400).json({ error: "You've already used your free trial on this account." });
    }

    const trialStart = Date.now();
    await billingRef.set(
      { trialStart, trialUsed: true, subEnd: existing.subEnd || null },
      { merge: true }
    );

    console.log(`[start-trial] uid=${uid} started trial at ${new Date(trialStart).toISOString()}`);
    return res.status(200).json({ success: true, trialStart });
  } catch (err) {
    console.error("[start-trial] Firestore write failed:", err);
    return res.status(500).json({ error: "Could not start trial — please try again." });
  }
}

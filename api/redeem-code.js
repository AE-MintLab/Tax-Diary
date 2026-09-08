// Vercel Serverless Function — redeems a beta/discount code for Plus access.
//
// Same security model as create-payment.js: the client proves who it is via
// a Firebase ID token (verified server-side, not trusted as-is), and only
// this trusted server context can write to users/{uid}/private/billing —
// per firestore.rules, the client itself can never write that path directly.
//
// Valid codes live in the REDEEM_CODES environment variable as a comma-
// separated list (e.g. "TAXDIARYBETA,FAMILY2026") — editable in Vercel
// without touching code or redeploying from GitHub.
import { getAdminAuth, getAdminDb } from "./_firebaseAdmin.js";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idToken, code } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: "Missing idToken" });
  }
  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Enter a code first." });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch (err) {
    console.error("[redeem-code] Invalid ID token:", err);
    return res.status(401).json({ error: "Your session has expired — please sign in again." });
  }
  const uid = decoded.uid;

  const validCodes = (process.env.REDEEM_CODES || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (!validCodes.includes(code.trim().toUpperCase())) {
    console.warn(`[redeem-code] Invalid code attempt by uid=${uid}: "${code}"`);
    return res.status(400).json({ error: "That code isn't valid." });
  }

  try {
    const billingRef = getAdminDb().doc(`users/${uid}/private/billing`);
    const snap = await billingRef.get();
    const existing = snap.exists ? snap.data() : {};
    const now = Date.now();
    // Same "extend from current expiry, not from now" logic as real payments —
    // redeeming a code while already on Plus shouldn't waste remaining time.
    const base = existing.subEnd && existing.subEnd > now ? existing.subEnd : now;
    const subEnd = base + YEAR_MS;

    await billingRef.set(
      { subEnd, lastRedeemedCode: code.trim().toUpperCase(), lastRedeemedAt: now },
      { merge: true }
    );

    console.log(`[redeem-code] uid=${uid} redeemed "${code}" — Plus active until ${new Date(subEnd).toISOString()}`);
    return res.status(200).json({ success: true, subEnd });
  } catch (err) {
    console.error("[redeem-code] Firestore write failed:", err);
    return res.status(500).json({ error: "Could not apply that code — please try again." });
  }
}

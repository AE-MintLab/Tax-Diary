// Vercel Serverless Function — receives ToyyibPay's server-to-server payment
// confirmation and, if genuine, marks the corresponding user as paid.
//
// CRITICAL: this URL is public. Anyone could POST fake "payment succeeded"
// data to it directly. The "hash" field is what proves a request genuinely
// came from ToyyibPay (who knows our secret key) rather than an attacker
// trying to grant themselves free Plus access — see the hash check below.
// This is a direct implementation of ToyyibPay's documented formula:
// https://toyyibpay.com/apireference/#cp
import crypto from "crypto";
import { adminDb } from "./_firebaseAdmin.js";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function md5(str) {
  return crypto.createHash("md5").update(str).digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { refno, status, billcode, order_id, amount, hash } = req.body || {};

  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  if (!secretKey) {
    console.error("[toyyibpay-callback] Missing TOYYIBPAY_SECRET_KEY");
    return res.status(500).send("Not configured");
  }

  // ToyyibPay's documented formula: MD5(userSecretKey + status + order_id + refno + "ok")
  const expectedHash = md5(secretKey + status + order_id + refno + "ok");
  if (hash !== expectedHash) {
    console.error("[toyyibpay-callback] HASH MISMATCH — rejecting, possible forged request", { billcode, order_id, status });
    return res.status(400).send("Invalid hash");
  }

  console.log(`[toyyibpay-callback] Verified callback: billcode=${billcode} order_id=${order_id} status=${status} amount=${amount}`);

  // status: 1 = success, 2 = pending, 3 = fail. Only credit the account on
  // confirmed success — pending/failed do nothing (the user just doesn't get
  // Plus, no error needed since ToyyibPay's own checkout already told them).
  if (status === "1") {
    const uid = order_id; // we set billExternalReferenceNo to the Firebase uid when creating the bill
    if (!uid) {
      console.error("[toyyibpay-callback] Success callback with no order_id/uid — cannot credit anyone");
      return res.status(400).send("Missing order_id");
    }

    try {
      const billingRef = adminDb.doc(`users/${uid}/private/billing`);
      const snap = await billingRef.get();
      const existing = snap.exists ? snap.data() : {};
      const now = Date.now();
      // Renewing early extends from the CURRENT expiry (if still active) rather
      // than from "now" — paying a few days before expiry shouldn't waste the
      // remaining paid time.
      const base = existing.subEnd && existing.subEnd > now ? existing.subEnd : now;
      const subEnd = base + YEAR_MS;

      await billingRef.set(
        { subEnd, lastPaymentAt: now, lastBillCode: billcode, lastAmount: amount },
        { merge: true }
      );

      console.log(`[toyyibpay-callback] Credited uid=${uid} — Plus active until ${new Date(subEnd).toISOString()}`);
    } catch (err) {
      console.error("[toyyibpay-callback] Failed to write to Firestore:", err);
      return res.status(500).send("Failed to record payment");
    }
  }

  // ToyyibPay just needs a 200 response to consider the callback delivered.
  return res.status(200).send("OK");
}

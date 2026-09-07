// Vercel Serverless Function — creates a ToyyibPay payment ("Bill") for the
// Tax Diary Plus subscription, tied to the signed-in user's Firebase account.
//
// Security model: the client sends its Firebase ID token (proof of who's
// signed in, NOT a password). We verify that token server-side before
// creating anything — an attacker can't just call this endpoint claiming to
// be someone else. The user's UID becomes ToyyibPay's "external reference
// number," which the payment callback later uses to know whose account to
// credit — see api/toyyibpay-callback.js.
import { adminAuth } from "./_firebaseAdmin.js";

const PLUS_PRICE_CENTS = 2900; // RM29.00 flat, per the product spec
const TOYYIBPAY_BASE = process.env.TOYYIBPAY_BASE_URL || "https://toyyibpay.com"; // use https://dev.toyyibpay.com for sandbox testing

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
    console.error("[create-payment] Invalid ID token:", err);
    return res.status(401).json({ error: "Your session has expired — please sign in again." });
  }

  const uid = decoded.uid;
  const email = decoded.email || "";

  const secretKey = process.env.TOYYIBPAY_SECRET_KEY;
  const categoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
  if (!secretKey || !categoryCode) {
    console.error("[create-payment] Missing TOYYIBPAY_SECRET_KEY or TOYYIBPAY_CATEGORY_CODE");
    return res.status(500).json({ error: "Payment gateway not configured yet." });
  }

  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

  // ToyyibPay's billName/billDescription only allow alphanumeric, space, and
  // underscore — no punctuation like colons or dashes.
  const params = new URLSearchParams({
    userSecretKey: secretKey,
    categoryCode: categoryCode,
    billName: "Tax Diary Plus",
    billDescription: "Tax Diary Plus 1 Year Subscription",
    billPriceSetting: "1", // fixed amount
    billPayorInfo: "1",
    billAmount: String(PLUS_PRICE_CENTS),
    billReturnUrl: `${appUrl}/?payment=return`,
    billCallbackUrl: `${appUrl}/api/toyyibpay-callback`,
    billExternalReferenceNo: uid,
    billTo: email || "Tax Diary User",
    billEmail: email || "noreply@example.com",
    billPhone: "0000000000", // not collected in-app; ToyyibPay requires a value
    billPaymentChannel: "2", // 0=FPX only, 1=card only, 2=both
    billExpiryDays: "1",
  });

  try {
    const billRes = await fetch(`${TOYYIBPAY_BASE}/index.php/api/createBill`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const text = await billRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("[create-payment] Non-JSON response from ToyyibPay:", text);
      return res.status(502).json({ error: "Unexpected response from payment gateway." });
    }

    const billCode = data?.[0]?.BillCode;
    if (!billCode) {
      console.error("[create-payment] No BillCode in response:", JSON.stringify(data));
      return res.status(502).json({ error: data?.[0]?.msg || "Could not create payment — please try again." });
    }

    console.log(`[create-payment] Created bill ${billCode} for uid=${uid}`);
    return res.status(200).json({ paymentUrl: `${TOYYIBPAY_BASE}/${billCode}`, billCode });
  } catch (err) {
    console.error("[create-payment] Unhandled error:", err);
    return res.status(500).json({ error: "Server error creating payment." });
  }
}

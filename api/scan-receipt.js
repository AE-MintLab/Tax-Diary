// Vercel Serverless Function — proxies the receipt-OCR call to Gemini.
//
// Why this exists: the client can NEVER hold a real Gemini API key (anyone
// could open dev tools and steal it, then run up your Google API bill).
// This function reads the key from a server-side environment variable
// (set in the Vercel dashboard, never committed to git) and is the only
// thing that talks to Google directly. The browser calls this endpoint
// instead — see the fetch to "/api/scan-receipt" in src/App.jsx.
//
// Vercel auto-detects any file in /api as a serverless function — no
// extra config needed, this just needs to exist at this path.

const GEMINI_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini's shared infrastructure occasionally returns 503 ("model is
// overloaded") or 429 (rate limited) even with a valid key and healthy quota —
// this is well-documented as a transient, server-side condition, and Google's
// own troubleshooting guidance is to retry with backoff.
//
// Kept to ONE retry (2 attempts total, short backoff): Vercel's Hobby plan
// hard-caps serverless functions at 10 seconds with no way to raise it, so
// piling on more retries risks causing a worse failure — a hard function
// timeout — in exchange for smoothing over an already-rare error.
async function callGeminiWithRetry(apiKey, body, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(GEMINI_URL_BASE + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) return res;

    const status = res.status;
    const isRetryable = status === 503 || status === 429;
    if (!isRetryable || attempt === maxAttempts) return res; // give up — caller handles the error response

    const errText = await res.text().catch(() => "");
    console.warn(`[scan-receipt] Gemini ${status} on attempt ${attempt}/${maxAttempts}, retrying in 600ms:`, errText);
    await sleep(600);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[scan-receipt] GEMINI_API_KEY is not set");
    return res.status(500).json({
      error: "GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || !mimeType) {
    console.error("[scan-receipt] Missing base64Data or mimeType in request body");
    return res.status(400).json({ error: "Missing base64Data or mimeType" });
  }

  const promptText = `Extract this Malaysian purchase receipt as JSON: {"merchant":"string","amount":number,"date":"YYYY-MM-DD","category":"one of: lifestyle, med_self, med_vaccination, med_dental, med_checkup, med_par, sports, edu_fees, edu_skills, med_ins, life_ins, tourism, childcare, sspn, epf, ev_green, home_loan, dis_child, dis_equip, breastfeed"}. Include CCTV, food waste grinders, transit centres, theme parks, NPRA-registered vaccines, dental. Return ONLY raw JSON. Today: ${new Date().toISOString().slice(0, 10)}.`;

  try {
    const geminiRes = await callGeminiWithRetry(apiKey, {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }, { inlineData: { mimeType, data: base64Data } }],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[scan-receipt] Gemini API returned ${geminiRes.status} after retries:`, errText);
      const friendly = geminiRes.status === 503
        ? "Google's AI service is temporarily overloaded — this usually clears up within a minute or two. Please try again shortly."
        : `Gemini API call failed (${geminiRes.status})`;
      return res.status(502).json({ error: friendly, detail: errText });
    }

    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const parsedText = candidate?.content?.parts?.[0]?.text;

    if (!parsedText) {
      // Gemini responded 200 but returned no usable content — usually a safety-filter
      // block (finishReason: SAFETY) or an empty candidates array. Log the full
      // response so we can see exactly why in Vercel's Logs page.
      console.error("[scan-receipt] Gemini returned no extractable text. Full response:", JSON.stringify(data));
      return res.status(502).json({ error: "Gemini returned no result (possibly blocked or empty response)", detail: JSON.stringify(data) });
    }

    const parsed = JSON.parse(parsedText);
    console.log("[scan-receipt] success:", parsed.merchant, parsed.amount);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("[scan-receipt] Unhandled error:", err);
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
}

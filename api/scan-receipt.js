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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables, then redeploy.",
    });
  }

  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: "Missing base64Data or mimeType" });
  }

  const promptText = `Extract this Malaysian purchase receipt as JSON: {"merchant":"string","amount":number,"date":"YYYY-MM-DD","category":"one of: lifestyle, med_self, med_vaccination, med_dental, med_checkup, med_par, sports, edu_fees, edu_skills, med_ins, life_ins, tourism, childcare, sspn, epf, ev_green, home_loan, dis_child, dis_equip, breastfeed"}. Include CCTV, food waste grinders, transit centres, theme parks, NPRA-registered vaccines, dental. Return ONLY raw JSON. Today: ${new Date().toISOString().slice(0, 10)}.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: promptText }, { inlineData: { mimeType, data: base64Data } }],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(502).json({ error: "Gemini API call failed", detail: errText });
    }

    const data = await geminiRes.json();
    const parsedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(parsedText);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: String(err) });
  }
}

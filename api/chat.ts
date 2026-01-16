import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

const JSON_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbx9frgMLevDIck5v_xm7tiyvlHp5-f1ZT6l1MoD5uUDrQrPb5toZEA71Wweyj9phfo/exec";

type Wine = Record<string, any>;

function toStr(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickField(w: Wine, wanted: string) {
  const wWanted = norm(wanted);
  for (const k of Object.keys(w)) {
    if (norm(k) === wWanted) return toStr(w[k]).trim();
  }
  return "";
}

function parseNum(input: string) {
  let s = (input || "").trim();
  if (!s || s === "-") return null;
  if (s.endsWith(",-")) s = s.slice(0, -2);
  s = s.replace(/[^\d,.]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reduce the dataset to relevant rows so we don't blow token limits.
 */
function filterInventoryForQuery(inventory: Wine[], userMessage: string) {
  const q = norm(userMessage);

  // Heuristic intent detection
  const wantsRiesling = q.includes("riesling");
  const wantsGlass = q.includes("by the glass") || q.includes("glass") || q.includes("glas");
  const wantsPrice = q.includes("price") || q.includes("pris") || q.includes("koster");
  const wantsStock = q.includes("stock") || q.includes("in stock") || q.includes("lager");

  // Keywords: split into meaningful tokens (basic)
  const tokens = q
    .split(/[^a-z0-9æøå]+/i)
    .map((t) => norm(t))
    .filter((t) => t.length >= 3)
    .slice(0, 12);

  // Score each wine
  const scored = inventory.map((w) => {
    const name = norm(pickField(w, "Name"));
    const maker = norm(pickField(w, "Winemaker"));
    const grapes = norm(pickField(w, "Grapes"));
    const region = norm(pickField(w, "Region"));
    const country = norm(pickField(w, "Country"));
    const notes = norm(pickField(w, "Notes"));
    const colour = norm(pickField(w, "Colour"));

    const hay = `${name} ${maker} ${grapes} ${region} ${country} ${notes} ${colour}`;

    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
    }

    // Strong boosts for common queries
    if (wantsRiesling && (grapes.includes("riesling") || name.includes("riesling"))) score += 10;
    if (wantsGlass && pickField(w, "Glass")) score += 6;

    return { w, score };
  });

  // Sort high score first
  scored.sort((a, b) => b.score - a.score);

  // If nothing matched at all, fallback to “useful subset”
  const best = scored.filter((x) => x.score > 0).slice(0, 40).map((x) => x.w);

  if (best.length > 0) return best;

  // fallback: if asking about glass, return all with Glass
  if (wantsGlass) {
    return inventory.filter((w) => !!pickField(w, "Glass")).slice(0, 60);
  }

  // fallback: general list (limit)
  return inventory.slice(0, 60);
}

function formatInventoryForPrompt(inventory: Wine[]) {
  const rows = inventory.map((w) => {
    const Price = pickField(w, "Price");
    const Stock = pickField(w, "Stock");
    const Glass = pickField(w, "Glass");

    return {
      Name: pickField(w, "Name") || "(unnamed)",
      Winemaker: pickField(w, "Winemaker") || "",
      Shelf: pickField(w, "Shelf") || "",
      Colour: pickField(w, "Colour") || "",
      Grapes: pickField(w, "Grapes") || "",
      Region: pickField(w, "Region") || "",
      Country: pickField(w, "Country") || "",
      Vintage: pickField(w, "Vintage") || "",
      Price: Price || "(empty)",
      Glass: Glass || "",
      Stock: Stock || "(empty)",
      Notes: pickField(w, "Notes") || "",
      _p: parseNum(Price),
      _s: parseNum(Stock),
    };
  });

  return JSON.stringify(rows);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_KEY in server env" });
    }

    const { userMessage, history } = req.body || {};
    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing userMessage" });
    }

    // 1) Fetch inventory on the server (no big client payloads)
    const invRes = await fetch(JSON_ENDPOINT);
    if (!invRes.ok) {
      return res.status(500).json({ error: "Failed to fetch inventory JSON" });
    }

    const data = await invRes.json();

    let inventory: Wine[] = [];
    if (Array.isArray(data)) inventory = data;
    else if (data && typeof data === "object") {
      inventory = data.data || data.items || data.rows || data.content || [];
    }

    // 2) Filter down to relevant rows (prevents token blowups)
    const filtered = filterInventoryForQuery(inventory, userMessage);
    const inventoryContext = formatInventoryForPrompt(filtered);

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
You are the "flere fugle wine assistant," a professional sommelier tool for bar staff.

Rules:
- Only use wines from DATA CONTEXT.
- Use "Price" for bottle price and "Glass" for by-the-glass.
- If Stock is "0": sold out.
- If Stock is "(empty)": stock level not set in the sheet.
- Keep answers concise and in Markdown. Bold wine names + producers.

DATA CONTEXT (filtered):
${inventoryContext}
    `.trim();

    const contents = (Array.isArray(history) ? history : []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: String(msg.content || "") }],
    }));

    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    return res.status(200).json({ text: response.text || "" });
  } catch (err: any) {
    console.error("API /chat error:", err);
    return res.status(500).json({
      error: "Gemini failed",
      details: String(err?.message || err),
    });
  }
}

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// IMPORTANT: import from your project path
import { formatInventoryForPrompt } from "../services/sheetService";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { userMessage, history, inventory } = req.body || {};

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_KEY in server env" });
    }

    if (!userMessage || typeof userMessage !== "string") {
      return res.status(400).json({ error: "Missing userMessage" });
    }

    // Build inventoryContext on the server (keeps client request small)
    const inventoryContext = formatInventoryForPrompt(Array.isArray(inventory) ? inventory : []);

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
You are the "flere fugle wine assistant," a professional sommelier tool for bar staff.

RULES:
- Only use wines in the inventory.
- Use Price for bottle price, Glass for by-the-glass.
- If Stock is 0: sold out. If Stock is "(empty)": stock not set.

DATA CONTEXT:
${inventoryContext}
    `.trim();

    const contents = (Array.isArray(history) ? history : []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: String(msg.content || "") }],
    }));

    // Add the newest user message
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

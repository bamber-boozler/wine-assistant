import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { userMessage, history, inventoryContext } = req.body || {};

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing API_KEY in server env" });
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
You are the "flere fugle wine assistant," a professional sommelier tool for bar staff.

DATA CONTEXT:
${inventoryContext}
    `.trim();

    const contents = (history || []).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
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
    return res.status(500).json({ error: "Gemini failed", details: String(err?.message || err) });
  }
}

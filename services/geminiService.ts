
import { GoogleGenAI } from "@google/genai";
import { Message, WineEntry } from "../types";
import { formatInventoryForPrompt } from "./sheetService";

export async function getChatResponse(
  userMessage: string, 
  history: Message[], 
  inventory: WineEntry[]
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const inventoryContext = formatInventoryForPrompt(inventory);
  
  const systemInstruction = `
    You are the "flere fugle wine assistant," a professional sommelier tool for bar staff.
    
    DATABASE INFO:
    You are looking at a live list of our wine cellar. 
    Each wine has a "Price" (string), "Stock" (string), and numeric helpers "_p" (price) and "_s" (stock).

    CRITICAL INSTRUCTIONS ON STOCK:
    1. If "_s" is 0 or "Stock" is "0", the wine is SOLD OUT.
    2. If "Stock" is "(empty)" or missing, we don't know the stock level—tell the staff: "Stock level is not set in the sheet, please check the shelf."
    3. If "Stock" has any other number (e.g. "5"), it is AVAILABLE.

    CRITICAL INSTRUCTIONS ON PRICE:
    1. If "Price" is "(empty)", tell the staff the price is not listed.
    2. Otherwise, ALWAYS use the value in "Price" (e.g. "450,-"). Never say it's missing if there is a value.

    DATA CONTEXT:
    ${inventoryContext}
  `;

  const contents = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents as any,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1,
      }
    });

    return response.text || "Database error.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "I am having trouble reading the cellar records. Please refresh.";
  }
}

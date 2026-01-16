import { Message, WineEntry } from "../types";
import { formatInventoryForPrompt } from "./sheetService";

export async function getChatResponseViaApi(
  userMessage: string,
  history: Message[],
  inventory: WineEntry[]
): Promise<string> {
  const inventoryContext = formatInventoryForPrompt(inventory);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage,
      history,
      inventoryContext,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("API error:", err);
    return "I am having trouble reading the cellar records. Please refresh.";
  }

  const data = await res.json();
  return data.text || "Database error.";
}

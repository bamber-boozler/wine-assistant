import { Message, WineEntry } from "../types";

function slimHistory(history: Message[], maxPairs = 6) {
  // maxPairs=6 means up to 12 messages total (user+assistant). Adjust if you want.
  const maxMessages = maxPairs * 2;

  return (history || [])
    .slice(-maxMessages)
    .map((m) => ({
      role: m.role,          // 'user' | 'assistant'
      content: m.content,    // ONLY what we need
    }));
}

export async function getChatResponseViaApi(
  userMessage: string,
  history: Message[],
  inventory: WineEntry[]
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userMessage,
      history: slimHistory(history, 6),
      inventory, // send raw inventory; server formats it
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("API error:", res.status, errText);
    return "I am having trouble reading the cellar records. Please refresh.";
  }

  const data = await res.json().catch(() => ({}));
  return data.text || "Database error.";
}

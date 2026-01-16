
import { WineEntry } from '../types';

const JSON_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx9frgMLevDIck5v_xm7tiyvlHp5-f1ZT6l1MoD5uUDrQrPb5toZEA71Wweyj9phfo/exec';

/**
 * Normalizes a string by removing hidden characters and collapsing whitespace.
 */
const normalizeKey = (s: string) =>
  String(s)
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Provides case-insensitive access to object keys from the JSON.
 */
function getLoose(wine: WineEntry, wanted: string): string | undefined {
  const w = normalizeKey(wanted).toLowerCase();
  for (const k of Object.keys(wine)) {
    if (normalizeKey(k).toLowerCase() === w) {
      const val = wine[k];
      return val !== null && val !== undefined ? String(val).trim() : undefined;
    }
  }
  return undefined;
}

export async function fetchInventory(): Promise<WineEntry[]> {
  try {
    const response = await fetch(JSON_ENDPOINT);
    if (!response.ok) throw new Error('Failed to fetch JSON data');
    
    const data = await response.json();
    
    // Google Apps Script usually returns an array of objects directly or wrapped in a 'data' property
    let rawItems: any[] = [];
    if (Array.isArray(data)) {
      rawItems = data;
    } else if (data && typeof data === 'object') {
      // Check for common wrappers like 'data', 'items', or 'rows'
      rawItems = data.data || data.items || data.rows || data.content || [];
    }
    
    console.log("DEBUG: Fetched JSON records:", rawItems.length);
    if (rawItems.length > 0) {
      console.log("DEBUG: Keys available in JSON:", Object.keys(rawItems[0]));
    }
    
    return rawItems;
  } catch (error) {
    console.error('JSON fetch error:', error);
    throw error;
  }
}

/**
 * Converts strings like "450,-" or "1.200,00" into clean numbers for AI reasoning.
 */
function parseNumericValue(input: string | undefined): number | null {
  if (input === undefined || input === null) return null;
  let s = String(input).trim();
  if (!s || s === "-") return null;

  if (s.endsWith(",-")) s = s.slice(0, -2);
  s = s.replace(/[^\d,.]/g, "");

  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function formatInventoryForPrompt(inventory: WineEntry[]): string {
  if (!inventory.length) return "[]";

  const rows = inventory.map((wine) => {
    const priceRaw = getLoose(wine, "Price");
    const stockRaw = getLoose(wine, "Stock");

    return {
      Name: getLoose(wine, "Name") || "(unnamed)",
      Winemaker: getLoose(wine, "Winemaker") || "",
      Price: priceRaw || "(empty)",
      Stock: stockRaw || "(empty)",
      Glass: getLoose(wine, "Glass") || "",
      Colour: getLoose(wine, "Colour") || "",
      Notes: getLoose(wine, "Notes") || "",
      _p: parseNumericValue(priceRaw),
      _s: parseNumericValue(stockRaw)
    };
  });

  // Use compact JSON to maximize AI context window
  return JSON.stringify(rows);
}

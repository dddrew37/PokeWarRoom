/**
 * sanitizeText.ts
 * Universal Mojibake eradicator for AI-generated and database-stored text.
 *
 * Targets all known UTF-8 misread sequences that arise when text is stored
 * or transmitted with incorrect encoding and later rendered in the browser.
 *
 * Usage: wrap any dynamic/AI/database string before rendering it in JSX.
 *   import { sanitizeText } from "../utils/sanitizeText";
 *   <p>{sanitizeText(someAiString)}</p>
 */
export function sanitizeText(str: string): string {
  if (!str || typeof str !== "string") return str ?? "";

  return str
    // ── Punctuation & Dashes ─────────────────────────────────────────────
    .replace(/â€"/g, "—")        // em dash
    .replace(/â€™/g, "'")        // right single quote / apostrophe
    .replace(/â€˜/g, "'")        // left single quote
    .replace(/â€œ/g, '"')        // left double quote
    .replace(/â€\u009d/g, '"')   // right double quote (with control char)
    .replace(/â€/g, '"')         // right double quote (fallback)
    .replace(/â€¦/g, "…")        // ellipsis
    .replace(/Â·/g, "·")         // middle dot
    .replace(/Â/g, "")           // lone Â artifact

    // ── Arrows & Symbols ─────────────────────────────────────────────────
    .replace(/â†'/g, "→")        // right arrow →
    .replace(/â†'/g, "←")        // left arrow ←
    .replace(/â†'/g, "↑")        // up arrow ↑
    .replace(/â†"/g, "↓")        // down arrow ↓

    // ── UI / Status Icons ────────────────────────────────────────────────
    .replace(/âš¡/g, "⚡")        // lightning bolt
    .replace(/âœ•/g, "✕")        // heavy X / cross
    .replace(/âœ"/g, "✓")        // check mark
    .replace(/âœ¦/g, "✦")        // star / sparkle
    .replace(/â˜ /g, "☠")        // skull
    .replace(/âš /g, "⚠")        // warning triangle (base)
    .replace(/âš\s?ï¸/g, "⚠️")   // warning emoji (with variation selector)
    .replace(/â–²/g, "▲")        // up-pointing triangle
    .replace(/â—/g, "●")         // filled circle
    .replace(/â—‹/g, "○")        // empty circle
    .replace(/â—†/g, "◆")        // filled diamond
    .replace(/â€¢/g, "•")        // bullet

    // ── Pokémon-Specific ─────────────────────────────────────────────────
    .replace(/PokÃ©mon/g, "Pokémon")
    .replace(/PokÃ©/g, "Poké")
    .replace(/Ã©/g, "é")
    .replace(/Ã/g, "à")

    // ── Catch-all for remaining lone Â/Ã prefixes ────────────────────────
    .replace(/[Â-Ã](?!\w)/g, "");
}

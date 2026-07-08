import metaData from "../data/meta_data.json";

export interface Pokemon {
  id: string;
  name: string;
  spriteUrl: string;
}

/**
 * Builds a Pokémon Showdown sprite URL from the PokeAPI id slug.
 * Showdown sprites use the raw slug with no modifications.
 */
function buildSpriteUrl(id: string): string {
  return `https://play.pokemonshowdown.com/sprites/gen5/${id}.png`;
}

/**
 * Full 1200+ Pokémon roster derived from meta_data.json.
 * Each entry includes its raw API id (used for sprite URLs) and formatted display name.
 */
export const metaPokemon: Pokemon[] = metaData.pokemon.map(p => ({
  id: p.id,
  name: p.name,
  spriteUrl: buildSpriteUrl(p.id),
}));

/**
 * Inline Pokéball SVG data URI for use as a fallback when a sprite fails to load.
 */
export const POKEBALL_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%2327272a' stroke='%2352525b' stroke-width='3'/%3E%3Cline x1='2' y1='50' x2='98' y2='50' stroke='%2352525b' stroke-width='3'/%3E%3Ccircle cx='50' cy='50' r='12' fill='%2327272a' stroke='%2352525b' stroke-width='3'/%3E%3Ccircle cx='50' cy='50' r='6' fill='%2352525b'/%3E%3C/svg%3E";

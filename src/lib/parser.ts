export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface ParsedPokemon {
  id: string;
  name: string;
  item: string;
  ability: string;
  nature: string;
  evs: Stats;
  sp: Stats;
  moves: string[];
}

export function convertEVtoSP(ev: number): number {
  if (ev <= 0) return 0;
  if (ev >= 244) return 32; // Standard cap for 252/244 in the custom engine
  return Math.floor((ev - 4) / 8) + 2;
}

/**
 * Strips all non-alphanumeric characters and lowercases for database matching.
 */
function normalize(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function parsePokePaste(paste: string): ParsedPokemon[] {
  // Lazy-load the meta database to avoid circular import issues at module level
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const metaData = require("../data/meta_data.json");

  // 0. Pre-Processor String Normalizer
  let text = paste.replace(/\t/g, ' ');
  text = text.replace(/\s*(Ability:)/gi, '\n$1');
  text = text.replace(/\s*(Level:)/gi, '\n$1');
  text = text.replace(/\s*(EVs:)/gi, '\n$1');
  text = text.replace(/\s*(IVs:)/gi, '\n$1');
  text = text.replace(/\s*([A-Z][a-z]+ Nature)/g, '\n$1');
  text = text.replace(/\s+(-\s)/g, '\n$1');
  text = text.replace(/\n{3,}/g, '\n\n');

  // 1. Normalize and Chunk
  // Detect whether this is a Limitless (3+ newlines) or Showdown (2 newlines) format
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  const delimiter = /\n{3,}/.test(normalizedText) ? /\n{3,}/ : /\n{2,}/;
  const pokemonBlocks = normalizedText.split(delimiter);

  const team: ParsedPokemon[] = [];

  // 2. Block-Level Scope: loop over isolated Pokémon blocks
  for (const block of pokemonBlocks) {
    const lines = block.split('\n');
    if (lines.length === 0 || !lines[0].trim()) continue;

    // 3. Isolate State: fresh defaults per Pokémon block — data cannot bleed between slots
    const firstLine = lines[0].trim();
    let name = firstLine;
    let item = '';
    if (firstLine.includes('@')) {
      const parts = firstLine.split('@');
      name = parts[0].trim();
      item = parts[1].trim();
    }

    // Remove gender (M) or (F) from name
    name = name.replace(/\s*\([MF]\)\s*/g, '').trim();

    let ability = '';
    let nature = '';
    let moves: string[] = [];
    const evs: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    // 4. Line-by-Line Evaluation (safely scoped inside a single Pokémon's block)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // safe: empty lines within a block, not block boundaries

      if (line.toLowerCase().startsWith('ability:')) {
        ability = line.substring(8).trim();
        continue;
      }

      if (/^EVs:/i.test(line)) {
        const evStr = line.replace(/^EVs:\s*/i, '').trim();
        const evParts = evStr.split('/');
        for (const part of evParts) {
          const match = part.trim().match(/(\d+)\s+([a-zA-Z]+)/);
          if (match) {
            const num = parseInt(match[1], 10) || 0;
            const s = match[2].toLowerCase();
            if (s === 'hp') evs.hp = num;
            if (s === 'atk') evs.atk = num;
            if (s === 'def') evs.def = num;
            if (s === 'spa') evs.spa = num;
            if (s === 'spd') evs.spd = num;
            if (s === 'spe') evs.spe = num;
          }
        }
        continue;
      }

      const natureMatch = line.match(/\b(?:Nature:\s*([A-Za-z]+)|([A-Za-z]+)\s+Nature)\b/i);
      if (natureMatch) {
        nature = (natureMatch[1] || natureMatch[2]).trim();
        continue;
      }

      if (/^- /i.test(line)) {
        moves.push(line.replace(/^- /, '').trim());
        continue;
      }
      // Note: IVs, Level, Tera Type, and other unhandled lines are safely skipped
    }

    const sp: Stats = {
      hp: convertEVtoSP(evs.hp),
      atk: convertEVtoSP(evs.atk),
      def: convertEVtoSP(evs.def),
      spa: convertEVtoSP(evs.spa),
      spd: convertEVtoSP(evs.spd),
      spe: convertEVtoSP(evs.spe),
    };

    // Normalize the parsed name and match against the meta_data.json database
    const normalizedInput = normalize(name);
    const match = metaData.pokemon.find(
      (p: { id: string; name: string }) => normalize(p.name) === normalizedInput || normalize(p.id) === normalizedInput
    );

    const resolvedId = match ? match.id : name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const resolvedName = match ? match.name : name;

    // 5. Save: push the completed Pokémon to the team array
    team.push({
      id: resolvedId,
      name: resolvedName,
      item,
      ability,
      nature,
      evs,
      sp,
      moves
    });
  }

  return team;
}


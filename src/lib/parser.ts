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
  spExplanations?: Record<string, string>;
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

  // 0. Aggressive Pre-Processor String Normalizer
  let text = paste.replace(/\u00A0/g, ' ').replace(/\t/g, ' ');

  // Strip invisible trailing/leading spaces on every line so blank lines become pure \n
  text = text.split('\n').map(line => line.trim()).join('\n');

  // Collapse massive vertical gaps into standard Showdown double-newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Un-flatten the HTML text by forcing newlines before key attributes
  text = text
    .replace(/\s*(Ability:)/gi, '\n$1')
    .replace(/\s*(Level:)/gi, '\n$1')
    .replace(/\s*(EVs:)/gi, '\n$1')
    .replace(/\s*(IVs:)/gi, '\n$1')
    .replace(/\s*([A-Z][a-z]+ Nature)/gi, '\n$1')
    .replace(/\s+(-\s)/g, '\n$1');

  // Final safety collapse in case un-flattening created weird gaps
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

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
    const parsedEVs: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

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
            if (s === 'hp') parsedEVs.hp = num;
            if (s === 'atk') parsedEVs.atk = num;
            if (s === 'def') parsedEVs.def = num;
            if (s === 'spa') parsedEVs.spa = num;
            if (s === 'spd') parsedEVs.spd = num;
            if (s === 'spe') parsedEVs.spe = num;
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

    const rawSum = parsedEVs.hp + parsedEVs.atk + parsedEVs.def + parsedEVs.spa + parsedEVs.spd + parsedEVs.spe;
    const allStatsAtMost32 = 
      parsedEVs.hp <= 32 &&
      parsedEVs.atk <= 32 &&
      parsedEVs.def <= 32 &&
      parsedEVs.spa <= 32 &&
      parsedEVs.spd <= 32 &&
      parsedEVs.spe <= 32;

    let sp: Stats;
    let evs: Stats;

    if (rawSum <= 66 && allStatsAtMost32) {
      sp = { ...parsedEVs };
      const backConvertSPtoEV = (sp: number) => sp <= 0 ? 0 : (sp - 1) * 8 + 4;
      evs = {
        hp: backConvertSPtoEV(parsedEVs.hp),
        atk: backConvertSPtoEV(parsedEVs.atk),
        def: backConvertSPtoEV(parsedEVs.def),
        spa: backConvertSPtoEV(parsedEVs.spa),
        spd: backConvertSPtoEV(parsedEVs.spd),
        spe: backConvertSPtoEV(parsedEVs.spe),
      };
    } else {
      evs = { ...parsedEVs };
      sp = {
        hp: convertEVtoSP(parsedEVs.hp),
        atk: convertEVtoSP(parsedEVs.atk),
        def: convertEVtoSP(parsedEVs.def),
        spa: convertEVtoSP(parsedEVs.spa),
        spd: convertEVtoSP(parsedEVs.spd),
        spe: convertEVtoSP(parsedEVs.spe),
      };
    }

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


import metaData from "../data/meta_data.json";

/**
 * Standard VGC Stats structure.
 */
export interface VGCStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/**
 * Match modifiers that affect in-battle speed.
 */
export interface MatchModifiers {
  // Speed modifications
  tailwind?: boolean;
  choiceScarf?: boolean;
  statStage?: number; // range of -6 to +6

  // Weather triggers
  weather?: string; // e.g., 'rain', 'sun', 'sand', 'snow'
  
  // Terrain triggers
  terrain?: string; // e.g., 'electric'

  // Abilities affecting speed
  ability?: string; // e.g., 'Swift Swim', 'Chlorophyll'

  // Held item
  item?: string; // e.g., 'Choice Scarf', 'Gengarite'

  // Turn tracking (Turn 1 rule for Megas)
  isTurn1?: boolean;

  // Name / ID of the Pokémon to resolve Mega form info if needed
  pokemonName?: string;

  // Specific stat inputs if overriding default calculations
  evs?: number; // Speed EVs (0 - 252)
  ivs?: number; // Speed IVs (usually 31)
  natureModifier?: number; // Nature multiplier (0.9, 1.0, 1.1)

  // Direct flag: if true, skips lvl 50 speed calculation and treats input baseSpeed as pre-calculated stat
  isSpeedStatDirect?: boolean;

  // Active status conditions
  isUnburdenActive?: boolean;
  isSlowStartActive?: boolean;
  hasStatus?: boolean;
}

/**
 * Battlefield state representing a single active Pokémon and/or global environment details.
 */
export interface BattleFieldState {
  name?: string;
  baseSpeed?: number;
  
  // Custom stats inputs
  evs?: number | VGCStats | Partial<VGCStats>;
  ivs?: number | VGCStats | Partial<VGCStats>;
  sp?: Partial<VGCStats>;
  nature?: string;
  natureModifier?: number;

  item?: string;
  ability?: string;
  modifiers?: MatchModifiers;

  // Environmental overrides
  isTrickRoom?: boolean;
  weather?: string;
  isTurn1?: boolean;
  terrain?: string;
  
  // Ability activation toggles
  isUnburdenActive?: boolean;
  isSlowStartActive?: boolean;
  hasStatus?: boolean;

  // Outputs
  modifiedSpeed?: number;

  // Support for wrapper objects (where BattleFieldState acts as global state container)
  activePokemon?: BattleFieldState[];
}

/**
 * Checks if the pokemon holding the given item qualifies for Mega Evolution on Turn 1
 * and returns the base speed of its Mega form.
 */
export function getMegaBaseSpeed(pokemonName: string, item: string): number | null {
  if (!item || !pokemonName) return null;

  const normalizedItem = item.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedPoke = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Custom Regulation M-B Mega mappings
  const megaStoneMap: Record<string, { id: string; speed: number }> = {
    gengarite: { id: "gengarmega", speed: 130 },
    metagrossite: { id: "metagrossmega", speed: 110 },
    froslassite: { id: "froslassmega", speed: 170 },
    scovillainite: { id: "scovillainmega", speed: 119 },
    charizarditey: { id: "charizardmegay", speed: 100 },
    charizardite: { id: "charizardmegay", speed: 100 }, // general fallback
  };

  const mapping = megaStoneMap[normalizedItem];
  if (mapping) {
    const basePoke = mapping.id.replace("mega", "").replace("y", "");
    if (normalizedPoke.includes(basePoke) || basePoke.includes(normalizedPoke)) {
      return mapping.speed;
    }
  }

  // Dynamic fallback: scan metaData if there is a match ending in "ite"
  if (normalizedItem.endsWith("ite")) {
    const baseName = normalizedItem.slice(0, -3); // e.g. "gengar"
    if (normalizedPoke.includes(baseName) || baseName.includes(normalizedPoke)) {
      const megaPoke = (metaData.pokemon as any[]).find(
        p => p.id === `${baseName}mega` || p.id === `${baseName}megay` || p.id === `${baseName}megax`
      );
      if (megaPoke) {
        return megaPoke.baseStats.spe;
      }
    }
  }

  return null;
}

/**
 * Looks up the base speed of a Pokémon from the metadata database.
 */
export function lookupBaseSpeed(name: string): number {
  if (!name) return 100;
  const normalizedInput = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const metaMon = (metaData.pokemon as any[]).find(
    m => m.id === normalizedInput || m.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === normalizedInput
  );
  return metaMon?.baseStats?.spe || 100;
}

/**
 * Calculates speed after applying all items, abilities, stages, and tailwind.
 */
export function calculateModifiedSpeed(baseSpeed: number, modifiers: MatchModifiers): number {
  let speed = baseSpeed;

  // 1. Regulation M-B Mandatory Rule: Turn 1 Mega Evolution Speed Override
  if (modifiers.isTurn1 && modifiers.item && modifiers.pokemonName) {
    const megaSpeed = getMegaBaseSpeed(modifiers.pokemonName, modifiers.item);
    if (megaSpeed !== null) {
      speed = megaSpeed;
    }
  }

  // 2. Resolve to initial speed stat (Level 50 standard stat math)
  let stat: number;
  if (modifiers.isSpeedStatDirect) {
    // If the baseSpeed is already calculated, but we Mega evolved on Turn 1, we must recalculate
    if (modifiers.isTurn1 && modifiers.item && modifiers.pokemonName && getMegaBaseSpeed(modifiers.pokemonName, modifiers.item) !== null) {
      const evs = modifiers.evs !== undefined ? modifiers.evs : 0;
      const ivs = modifiers.ivs !== undefined ? modifiers.ivs : 31;
      const natureMod = modifiers.natureModifier !== undefined ? modifiers.natureModifier : 1.0;
      const rawStat = Math.floor((((2 * speed + ivs + Math.floor(evs / 4)) * 50) / 100) + 5);
      stat = Math.floor(rawStat * natureMod);
    } else {
      stat = baseSpeed;
    }
  } else {
    const evs = modifiers.evs !== undefined ? modifiers.evs : 0;
    const ivs = modifiers.ivs !== undefined ? modifiers.ivs : 31;
    const natureMod = modifiers.natureModifier !== undefined ? modifiers.natureModifier : 1.0;
    const rawStat = Math.floor((((2 * speed + ivs + Math.floor(evs / 4)) * 50) / 100) + 5);
    stat = Math.floor(rawStat * natureMod);
  }

  // 3. Process Stat Stages (+1: x1.5, -1: x0.66, etc.)
  const stage = modifiers.statStage !== undefined ? modifiers.statStage : 0;
  if (stage !== 0) {
    let stageMod = 1;
    if (stage > 0) {
      stageMod = (2 + stage) / 2;
    } else {
      stageMod = 2 / (2 - stage);
    }
    stat = Math.floor(stat * stageMod);
  }

  // 4. Process Tailwind (x2)
  if (modifiers.tailwind) {
    stat = Math.floor(stat * 2);
  }

  // 5. Process Items (Choice Scarf: x1.5, Iron Ball / Macho Brace / Power Items: x0.5)
  if (modifiers.choiceScarf || (modifiers.item && modifiers.item.toLowerCase().replace(/[^a-z]/g, "") === "choicescarf")) {
    stat = Math.floor(stat * 1.5);
  } else if (modifiers.item) {
    const itemNorm = modifiers.item.toLowerCase().replace(/[^a-z]/g, "");
    if (itemNorm === "ironball" || itemNorm === "machobrace" || itemNorm.startsWith("power")) {
      stat = Math.floor(stat * 0.5);
    }
  }

  // 6. Process Abilities (Swift Swim, Chlorophyll, etc.)
  if (modifiers.ability) {
    const abilityNorm = modifiers.ability.toLowerCase().replace(/[^a-z]/g, "");
    const weatherNorm = modifiers.weather ? modifiers.weather.toLowerCase().trim() : "";

    if (abilityNorm === "swiftswim" && (weatherNorm === "rain" || weatherNorm === "heavy rain" || weatherNorm === "drizzle")) {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "chlorophyll" && (weatherNorm === "sun" || weatherNorm === "sunny" || weatherNorm === "harsh sunshine" || weatherNorm === "drought")) {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "sandrush" && (weatherNorm === "sand" || weatherNorm === "sandstorm")) {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "slushrush" && (weatherNorm === "snow" || weatherNorm === "hail")) {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "surgesurfer" && modifiers.terrain && modifiers.terrain.toLowerCase() === "electric") {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "unburden" && modifiers.isUnburdenActive) {
      stat = Math.floor(stat * 2);
    } else if (abilityNorm === "slowstart" && modifiers.isSlowStartActive) {
      stat = Math.floor(stat * 0.5);
    } else if (abilityNorm === "quickfeet" && modifiers.hasStatus) {
      stat = Math.floor(stat * 1.5);
    }
  }

  return stat;
}

/**
 * Master function to determine active Pokémon turn order.
 */
export function determineTurnOrder(activePokemon: BattleFieldState | BattleFieldState[]): BattleFieldState[] {
  let list: BattleFieldState[] = [];
  let isTrickRoomActive = false;
  let weather = "none";
  let isTurn1 = false;

  // Parse input either as a collection of pokemon states or as a global state wrapper
  if (Array.isArray(activePokemon)) {
    list = [...activePokemon];
    if (list.length > 0) {
      isTrickRoomActive = list[0].isTrickRoom || false;
      weather = list[0].weather || "none";
      isTurn1 = list[0].isTurn1 || false;
    }
  } else if (activePokemon && typeof activePokemon === "object") {
    if (Array.isArray(activePokemon.activePokemon)) {
      list = [...activePokemon.activePokemon];
      isTrickRoomActive = activePokemon.isTrickRoom || false;
      weather = activePokemon.weather || "none";
      isTurn1 = activePokemon.isTurn1 || false;
    } else {
      list = [activePokemon];
      isTrickRoomActive = activePokemon.isTrickRoom || false;
      weather = activePokemon.weather || "none";
      isTurn1 = activePokemon.isTurn1 || false;
    }
  }

  // Calculate speed for all active Pokémon
  const calculatedList = list.map(mon => {
    const baseSpeed = mon.baseSpeed !== undefined ? mon.baseSpeed : (mon.name ? lookupBaseSpeed(mon.name) : 100);

    // Resolve EVs
    let speEvs = 0;
    if (typeof mon.evs === "number") {
      speEvs = mon.evs;
    } else if (mon.evs && typeof mon.evs === "object") {
      speEvs = mon.evs.spe || 0;
    } else if (mon.sp && typeof (mon as any).sp === "object") {
      // Custom SP math conversion: SP * 8 = EV
      speEvs = (((mon as any).sp.spe || 0) * 8);
    }

    // Resolve IVs
    let speIvs = 31;
    if (typeof mon.ivs === "number") {
      speIvs = mon.ivs;
    } else if (mon.ivs && typeof mon.ivs === "object") {
      speIvs = mon.ivs.spe !== undefined ? mon.ivs.spe : 31;
    }

    // Resolve Nature Modifier
    let natureMod = 1.0;
    if (mon.natureModifier !== undefined) {
      natureMod = mon.natureModifier;
    } else if (mon.nature) {
      const n = mon.nature.toLowerCase().trim();
      if (["jolly", "timid", "naive", "hasty"].includes(n)) {
        natureMod = 1.1;
      } else if (["brave", "relaxed", "quiet", "sassy"].includes(n)) {
        natureMod = 0.9;
      }
    }

    // Resolve individual modifiers, falling back to top level or environmental properties
    const monModifiers = mon.modifiers || {};
    const mergedModifiers: MatchModifiers = {
      tailwind: monModifiers.tailwind !== undefined ? monModifiers.tailwind : !!(mon as any).tailwind,
      choiceScarf: monModifiers.choiceScarf !== undefined ? monModifiers.choiceScarf : !!(mon as any).choiceScarf,
      statStage: monModifiers.statStage !== undefined ? monModifiers.statStage : ((mon as any).statStage || 0),
      weather: monModifiers.weather || mon.weather || weather,
      ability: monModifiers.ability || mon.ability,
      item: monModifiers.item || mon.item,
      isTurn1: monModifiers.isTurn1 !== undefined ? monModifiers.isTurn1 : (mon.isTurn1 !== undefined ? mon.isTurn1 : isTurn1),
      pokemonName: monModifiers.pokemonName || mon.name,
      evs: monModifiers.evs !== undefined ? monModifiers.evs : speEvs,
      ivs: monModifiers.ivs !== undefined ? monModifiers.ivs : speIvs,
      natureModifier: monModifiers.natureModifier !== undefined ? monModifiers.natureModifier : natureMod,
      terrain: monModifiers.terrain || mon.terrain || (activePokemon && typeof activePokemon === "object" && (activePokemon as any).terrain),
      isUnburdenActive: monModifiers.isUnburdenActive !== undefined ? monModifiers.isUnburdenActive : mon.isUnburdenActive,
      isSlowStartActive: monModifiers.isSlowStartActive !== undefined ? monModifiers.isSlowStartActive : mon.isSlowStartActive,
      hasStatus: monModifiers.hasStatus !== undefined ? monModifiers.hasStatus : mon.hasStatus,
      isSpeedStatDirect: monModifiers.isSpeedStatDirect,
    };

    const modifiedSpeed = calculateModifiedSpeed(baseSpeed, mergedModifiers);

    return {
      ...mon,
      modifiedSpeed,
    };
  });

  // Sort comparison
  calculatedList.sort((a, b) => {
    const speedA = a.modifiedSpeed || 0;
    const speedB = b.modifiedSpeed || 0;

    if (isTrickRoomActive) {
      // Sort ascending (slowest first)
      return speedA - speedB;
    } else {
      // Sort descending (fastest first)
      return speedB - speedA;
    }
  });

  return calculatedList;
}

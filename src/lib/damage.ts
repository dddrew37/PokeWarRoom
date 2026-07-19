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
 * Attacker or defender representation for damage calculations.
 */
export interface DamagePokemon {
  name: string;
  id?: string;
  baseStats?: VGCStats;
  sp?: Partial<VGCStats>; // Custom SP stats structure
  nature?: string;
  item?: string;
  ability?: string;
}

/**
 * Modifiers affecting the damage formula.
 */
export interface DamageModifiers {
  stab?: boolean;
  typeEffectiveness?: number; // x0, x0.25, x0.5, x1, x2, x4
  item?: string; // "Life Orb", "Choice Band", "Choice Specs"
  attackerMaxStats?: boolean; // Toggles 252 EV / positive nature for opponent attacker
  defenderMaxStats?: boolean; // Toggles 252 EV / positive nature for opponent defender
  attackerStatStage?: number; // range of -6 to +6
  defenderStatStage?: number; // range of -6 to +6
}

/**
 * Converts a Pokémon's SP point allocation to its EV representation.
 * EV = (SP - 1) * 8 + 4 (if SP > 0), else 0.
 */
export function convertSPToEV(sp: number): number {
  if (sp <= 0) return 0;
  return (sp - 1) * 8 + 4;
}

/**
 * Calculates a Pokémon's Level 50 in-battle stat value.
 * Assumes perfect 31 IVs.
 */
export function calculateLevel50Stat(
  base: number,
  sp: number = 0,
  natureModifier: number = 1.0,
  isHP: boolean = false
): number {
  const ev = convertSPToEV(sp);
  if (isHP) {
    // HP = Math.floor(((2 * Base + IV + Math.floor(EV/4)) * Level)/100) + Level + 10
    return Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * 50) / 100) + 60;
  } else {
    // Stat = Math.floor((Math.floor(((2 * Base + IV + Math.floor(EV/4)) * Level)/100) + 5) * Nature)
    const raw = Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * 50) / 100) + 5;
    return Math.floor(raw * natureModifier);
  }
}

/**
 * Resolves standard nature multiplier for a given stat.
 */
export function getNatureModifier(nature: string = "", statName: "atk" | "def" | "spa" | "spd" | "spe"): number {
  const n = nature.toLowerCase().trim();
  
  const plusAtk = ["lonely", "brave", "adamant", "naughty"];
  const minusAtk = ["bold", "timid", "modest", "calm"];
  const plusDef = ["bold", "relaxed", "impish", "lax"];
  const minusDef = ["lonely", "hasty", "mild", "gentle"];
  const plusSpA = ["modest", "quiet", "mild", "rash"];
  const minusSpA = ["adamant", "jolly", "impish", "careful"];
  const plusSpD = ["calm", "sassy", "careful", "gentle"];
  const minusSpD = ["naughty", "naive", "lax", "rash"];

  if (statName === "atk") {
    if (plusAtk.includes(n)) return 1.1;
    if (minusAtk.includes(n)) return 0.9;
  }
  if (statName === "def") {
    if (plusDef.includes(n)) return 1.1;
    if (minusDef.includes(n)) return 0.9;
  }
  if (statName === "spa") {
    if (plusSpA.includes(n)) return 1.1;
    if (minusSpA.includes(n)) return 0.9;
  }
  if (statName === "spd") {
    if (plusSpD.includes(n)) return 1.1;
    if (minusSpD.includes(n)) return 0.9;
  }
  return 1.0;
}

/**
 * Helper to lookup base stats from metadata.
 */
export function lookupBaseStats(name: string): VGCStats {
  if (!name) return { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
  const normalizedInput = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const metaMon = (metaData.pokemon as any[]).find(
    m => m.id === normalizedInput || m.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === normalizedInput
  );
  return metaMon?.baseStats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
}

/**
 * Calculates damage range and OHKO probability.
 * Gen 9 Level 50 formula: ((22 * Power * Attack / Defense) / 50) + 2.
 */
export function calculateDamage(
  attacker: DamagePokemon,
  defender: DamagePokemon,
  power: number,
  category: "Physical" | "Special",
  modifiers: DamageModifiers
): {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  isGuaranteedOHKO: boolean;
  attackerStat: number;
  defenderStat: number;
  defenderMaxHP: number;
} {
  // Resolve base stats
  const atkBase = attacker.baseStats || lookupBaseStats(attacker.name);
  const defBase = defender.baseStats || lookupBaseStats(defender.name);

  // Resolve stat categories
  const isPhys = category === "Physical";
  const atkStatName = isPhys ? "atk" : "spa";
  const defStatName = isPhys ? "def" : "spd";

  // Resolve SP allocations
  let atkSp = attacker.sp?.[atkStatName] || 0;
  let defSp = defender.sp?.[defStatName] || 0;
  let defHpSp = defender.sp?.hp || 0;

  // Resolve nature modifiers
  let atkNatureMod = getNatureModifier(attacker.nature, atkStatName);
  let defNatureMod = getNatureModifier(defender.nature, defStatName);

  // Apply max stats overrides for opponent checks if toggled
  if (modifiers.attackerMaxStats) {
    atkSp = 32;
    atkNatureMod = 1.1;
  }
  if (modifiers.defenderMaxStats) {
    defSp = 32;
    defHpSp = 32;
    defNatureMod = 1.0;
  }

  // Calculate base Level 50 integers
  let atkValue = calculateLevel50Stat(atkBase[atkStatName], atkSp, atkNatureMod, false);
  let defValue = calculateLevel50Stat(defBase[defStatName], defSp, defNatureMod, false);
  const defenderHP = calculateLevel50Stat(defBase.hp, defHpSp, 1.0, true);

  // Apply stat stage modifiers
  const atkStage = modifiers.attackerStatStage || 0;
  if (atkStage !== 0) {
    const stageMod = atkStage > 0 ? (2 + atkStage) / 2 : 2 / (2 - atkStage);
    atkValue = Math.floor(atkValue * stageMod);
  }
  const defStage = modifiers.defenderStatStage || 0;
  if (defStage !== 0) {
    const stageMod = defStage > 0 ? (2 + defStage) / 2 : 2 / (2 - defStage);
    defValue = Math.floor(defValue * stageMod);
  }

  // Standard VGC Damage Math
  const safeDef = defValue || 1;
  const baseDamage = Math.floor(((22 * power * atkValue) / safeDef) / 50) + 2;

  // Apply lowest (85%) and highest (100%) damage rolls
  let minDamage = Math.floor(baseDamage * 0.85);
  let maxDamage = baseDamage;

  // Apply STAB (1.5x)
  if (modifiers.stab) {
    minDamage = Math.floor(minDamage * 1.5);
    maxDamage = Math.floor(maxDamage * 1.5);
  }

  // Apply common Item boosts (Life Orb x1.3, Choice Band/Specs x1.5)
  const activeItem = modifiers.item || attacker.item || "";
  const normalizedItem = activeItem.toLowerCase().replace(/[^a-z]/g, "");

  if (normalizedItem === "lifeorb") {
    minDamage = Math.floor(minDamage * 1.3);
    maxDamage = Math.floor(maxDamage * 1.3);
  } else if (
    (normalizedItem === "choiceband" && isPhys) ||
    (normalizedItem === "choicespecs" && !isPhys)
  ) {
    minDamage = Math.floor(minDamage * 1.5);
    maxDamage = Math.floor(maxDamage * 1.5);
  }

  // Apply Type Effectiveness multiplier
  const effectiveness = modifiers.typeEffectiveness !== undefined ? modifiers.typeEffectiveness : 1.0;
  minDamage = Math.floor(minDamage * effectiveness);
  maxDamage = Math.floor(maxDamage * effectiveness);

  // Calculate percentages
  const safeHP = defenderHP || 1;
  const minPercent = parseFloat(((minDamage / safeHP) * 100).toFixed(1));
  const maxPercent = parseFloat(((maxDamage / safeHP) * 100).toFixed(1));

  // Determine OHKO status
  const isGuaranteedOHKO = minDamage >= safeHP;

  return {
    minDamage,
    maxDamage,
    minPercent,
    maxPercent,
    isGuaranteedOHKO,
    attackerStat: atkValue,
    defenderStat: defValue,
    defenderMaxHP: defenderHP,
  };
}

import { ParsedPokemon } from "../lib/parser";
import { Pokemon } from "../lib/pokemon";
import metaData from "../data/meta_data.json";

interface CalculatedStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
}

export function calculateStats(
  pokemon: ParsedPokemon | Pokemon,
  side: "player" | "opponent",
  isMaxStat: boolean = false
): CalculatedStats {
  const normalizedInput = pokemon.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const metaMon = (metaData.pokemon as any[]).find(
    (m: any) =>
      m.id === normalizedInput ||
      m.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === normalizedInput
  );
  const baseStats = metaMon?.baseStats || { hp: 100, atk: 100, def: 100, spa: 100, spd: 100 };

  const getStat = (statName: keyof CalculatedStats) => {
    let evs = 0;
    let natureMod = 1.0;

    if (side === "player") {
      const parsed = pokemon as ParsedPokemon;
      evs = (parsed.sp?.[statName as keyof typeof parsed.sp] || 0) * 8;
      const nature = (parsed.nature || "").toLowerCase();
      
      // Basic nature logic
      const plusAtk = ["lonely", "brave", "adamant", "naughty"];
      const minusAtk = ["bold", "timid", "modest", "calm"];
      const plusDef = ["bold", "relaxed", "impish", "lax"];
      const minusDef = ["lonely", "hasty", "mild", "gentle"];
      const plusSpA = ["modest", "quiet", "mild", "rash"];
      const minusSpA = ["adamant", "jolly", "impish", "careful"];
      const plusSpD = ["calm", "sassy", "careful", "gentle"];
      const minusSpD = ["naughty", "naive", "lax", "rash"];

      if (statName === "atk" && plusAtk.includes(nature)) natureMod = 1.1;
      if (statName === "atk" && minusAtk.includes(nature)) natureMod = 0.9;
      if (statName === "def" && plusDef.includes(nature)) natureMod = 1.1;
      if (statName === "def" && minusDef.includes(nature)) natureMod = 0.9;
      if (statName === "spa" && plusSpA.includes(nature)) natureMod = 1.1;
      if (statName === "spa" && minusSpA.includes(nature)) natureMod = 0.9;
      if (statName === "spd" && plusSpD.includes(nature)) natureMod = 1.1;
      if (statName === "spd" && minusSpD.includes(nature)) natureMod = 0.9;
    } else {
      if (isMaxStat) {
        evs = 252;
        natureMod = 1.1; // Assume beneficial nature if max stat is toggled
      }
    }

    if (statName === "hp") {
      return Math.floor(((2 * baseStats.hp + 31 + Math.floor(evs / 4)) * 50) / 100) + 60;
    } else {
      const rawStat = Math.floor(((2 * baseStats[statName] + 31 + Math.floor(evs / 4)) * 50) / 100) + 5;
      return Math.floor(rawStat * natureMod);
    }
  };

  return {
    hp: getStat("hp"),
    atk: getStat("atk"),
    def: getStat("def"),
    spa: getStat("spa"),
    spd: getStat("spd"),
  };
}

export interface DamageModifiers {
  stab: boolean;
  spread: boolean;
  typeEffectiveness: number; // 0.25, 0.5, 1, 2, 4
}

export interface DamageResult {
  minDamage: number;
  maxDamage: number;
  minPercent: number;
  maxPercent: number;
  koChance: string;
}

export function calculateDamage(
  attackerStats: CalculatedStats,
  defenderStats: CalculatedStats,
  basePower: number,
  category: "Physical" | "Special",
  modifiers: DamageModifiers
): DamageResult {
  const atk = category === "Physical" ? attackerStats.atk : attackerStats.spa;
  const def = category === "Physical" ? defenderStats.def : defenderStats.spd;
  const hp = defenderStats.hp;

  // Base Damage Formula
  let damage = Math.floor(Math.floor((22 * basePower * (atk / def)) / 50) + 2);

  // Apply Modifiers
  if (modifiers.spread) damage = Math.floor(damage * 0.75);
  if (modifiers.stab) damage = Math.floor(damage * 1.5);
  damage = Math.floor(damage * modifiers.typeEffectiveness);

  const minDamage = Math.floor(damage * 0.85);
  const maxDamage = Math.floor(damage * 1.00);

  const minPercent = Number(((minDamage / hp) * 100).toFixed(1));
  const maxPercent = Number(((maxDamage / hp) * 100).toFixed(1));

  let koChance = "Guaranteed to survive";
  if (minPercent >= 100) {
    koChance = "Guaranteed OHKO";
  } else if (maxPercent >= 100) {
    koChance = "Possible OHKO";
  } else if (minPercent >= 50) {
    koChance = "Guaranteed 2HKO";
  } else if (maxPercent >= 50) {
    koChance = "Possible 2HKO";
  } else if (minPercent >= 33.3) {
    koChance = "Guaranteed 3HKO";
  } else if (maxPercent >= 33.3) {
    koChance = "Possible 3HKO";
  }

  return {
    minDamage,
    maxDamage,
    minPercent,
    maxPercent,
    koChance,
  };
}

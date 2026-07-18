"use client";

import { useState, useMemo, useEffect } from "react";
import { ParsedPokemon } from "../lib/parser";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { calculateDamage, lookupBaseStats, DamageModifiers } from "../lib/damage";
import metaData from "../data/meta_data.json";

interface DamageCalculatorProps {
  playerMons: ParsedPokemon[];
  opponentMons: Pokemon[];
}

// standard 18-type chart for type effectiveness calculations
const TYPE_CHART: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Steel: 0.5, Dark: 0 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 }
};

const ALL_TYPES = Object.keys(TYPE_CHART);

function getMonTypes(name: string): string[] {
  if (!name) return ["Normal"];
  const normalized = name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const found = (metaData.pokemon as any[]).find(
    m => m.id === normalized || m.name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === normalized
  );
  return found?.types || ["Normal"];
}

export default function DamageCalculator({ playerMons, opponentMons }: DamageCalculatorProps) {
  const [attackerIndex, setAttackerIndex] = useState<number>(0);
  const [defenderIndex, setDefenderIndex] = useState<number>(0);

  const [basePower, setBasePower] = useState<number>(80);
  const [category, setCategory] = useState<"Physical" | "Special">("Physical");
  const [moveType, setMoveType] = useState<string>("Normal");
  
  // Custom manual modifier overrides
  const [heldItem, setHeldItem] = useState<string>("None");
  const [defenderMaxStats, setDefenderMaxStats] = useState<boolean>(true);
  const [attackerStage, setAttackerStage] = useState<number>(0);
  const [defenderStage, setDefenderStage] = useState<number>(0);

  const attacker = playerMons[attackerIndex];
  const defender = opponentMons[defenderIndex];

  // Auto-correct indexes if team sizes change
  useEffect(() => {
    if (attackerIndex >= playerMons.length && playerMons.length > 0) {
      setAttackerIndex(0);
    }
  }, [playerMons, attackerIndex]);

  useEffect(() => {
    if (defenderIndex >= opponentMons.length && opponentMons.length > 0) {
      setDefenderIndex(0);
    }
  }, [opponentMons, defenderIndex]);

  // Set Move Type to primary type of new attacker on selection
  useEffect(() => {
    if (attacker) {
      const types = getMonTypes(attacker.name);
      if (types.length > 0) {
        setMoveType(types[0]);
      }
    }
  }, [attackerIndex, attacker]);

  // Look up types
  const attackerTypes = useMemo(() => (attacker ? getMonTypes(attacker.name) : ["Normal"]), [attacker]);
  const defenderTypes = useMemo(() => (defender ? getMonTypes(defender.name) : ["Normal"]), [defender]);

  // Auto-determine STAB
  const isStab = useMemo(() => {
    return attackerTypes.includes(moveType);
  }, [attackerTypes, moveType]);

  // Auto-determine type effectiveness
  const effectiveness = useMemo(() => {
    let mult = 1.0;
    for (const t of defenderTypes) {
      const chart = TYPE_CHART[moveType];
      if (chart && chart[t] !== undefined) {
        mult *= chart[t];
      }
    }
    return mult;
  }, [moveType, defenderTypes]);

  // Perform Gen 9 damage math
  const result = useMemo(() => {
    if (!attacker || !defender) return null;

    const baseAttacker = {
      name: attacker.name,
      id: attacker.id,
      sp: attacker.sp,
      nature: attacker.nature,
      item: attacker.item,
      ability: attacker.ability,
    };

    const baseDefender = {
      name: defender.name,
      id: defender.id,
    };

    const mods: DamageModifiers = {
      stab: isStab,
      typeEffectiveness: effectiveness,
      item: heldItem !== "None" ? heldItem : undefined,
      defenderMaxStats,
      attackerStatStage: attackerStage,
      defenderStatStage: defenderStage,
    };

    return calculateDamage(baseAttacker, baseDefender, basePower, category, mods);
  }, [
    attacker,
    defender,
    basePower,
    category,
    effectiveness,
    isStab,
    heldItem,
    defenderMaxStats,
    attackerStage,
    defenderStage,
  ]);

  // Determine KO chance description
  const koChanceText = useMemo(() => {
    if (!result) return "No data";
    const { minPercent, maxPercent } = result;
    if (minPercent >= 100) {
      return "Guaranteed OHKO";
    } else if (maxPercent >= 100) {
      return "Possible OHKO";
    } else if (minPercent >= 50) {
      return "Guaranteed 2HKO";
    } else if (maxPercent >= 50) {
      return "Possible 2HKO";
    } else if (minPercent >= 33.3) {
      return "Guaranteed 3HKO";
    } else if (maxPercent >= 33.3) {
      return "Possible 3HKO";
    } else {
      return "Guaranteed to survive";
    }
  }, [result]);

  if (playerMons.length === 0 || opponentMons.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-zinc-950 border border-red-950/40 rounded-2xl p-5 shadow-inner relative overflow-hidden flex flex-col gap-5">
      <div className="absolute top-0 left-0 w-32 h-full bg-red-700/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div>
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 font-mono">
          <svg className="w-4 h-4 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
          Damage Calculator
        </h3>
        <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono mt-1">Zero-Latency Local Damage Sim</p>
      </div>

      {/* Attacker & Defender Selectors */}
      <div className="grid grid-cols-2 gap-4">
        {/* Attacker Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Attacker (Player)</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 p-2 rounded-xl">
            <img 
              src={attacker ? `https://play.pokemonshowdown.com/sprites/gen5/${attacker.id}.png` : POKEBALL_FALLBACK} 
              className="w-10 h-10 object-contain bg-zinc-950 border border-zinc-800 rounded-lg shrink-0"
              onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
            />
            <div className="flex flex-col w-full min-w-0">
              <select 
                value={attackerIndex} 
                onChange={(e) => setAttackerIndex(parseInt(e.target.value))}
                className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer uppercase tracking-wider font-mono w-full font-bold"
              >
                {playerMons.map((mon, i) => (
                  <option key={`atk-${i}`} value={i} className="bg-zinc-900 text-zinc-300 font-bold">{mon.name}</option>
                ))}
              </select>
              <span className="text-[8px] text-zinc-550 font-bold uppercase font-mono mt-0.5 truncate">
                {attackerTypes.join(" / ")}
              </span>
            </div>
          </div>
        </div>

        {/* Defender Select */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Defender (Opponent)</label>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-850 p-2 rounded-xl">
            <img 
              src={defender ? `https://play.pokemonshowdown.com/sprites/gen5/${defender.id}.png` : POKEBALL_FALLBACK} 
              className="w-10 h-10 object-contain bg-zinc-950 border border-zinc-800 rounded-lg shrink-0"
              onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
            />
            <div className="flex flex-col w-full min-w-0">
              <select 
                value={defenderIndex} 
                onChange={(e) => setDefenderIndex(parseInt(e.target.value))}
                className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer uppercase tracking-wider font-mono w-full font-bold"
              >
                {opponentMons.map((mon, i) => (
                  <option key={`def-${i}`} value={i} className="bg-zinc-900 text-zinc-300 font-bold">{mon.name}</option>
                ))}
              </select>
              <span className="text-[8px] text-zinc-550 font-bold uppercase font-mono mt-0.5 truncate">
                {defenderTypes.join(" / ")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Move Type & Base Power inputs */}
      <div className="grid grid-cols-3 gap-3 items-end font-mono">
        {/* Move Type Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Move Type</label>
          <select 
            value={moveType} 
            onChange={(e) => setMoveType(e.target.value)}
            className="bg-zinc-900 border border-zinc-850 text-xs font-black text-zinc-300 p-2 rounded-xl focus:outline-none cursor-pointer uppercase tracking-wider"
          >
            {ALL_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Base Power input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Base Power</label>
          <input 
            type="number" 
            value={basePower}
            onChange={(e) => setBasePower(Math.max(0, parseInt(e.target.value) || 0))}
            className="bg-zinc-900 border border-zinc-850 text-white text-xs font-black p-2 rounded-xl w-full text-center focus:outline-none focus:border-red-900"
          />
        </div>

        {/* Category Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Category</label>
          <button
            onClick={() => setCategory(category === "Physical" ? "Special" : "Physical")}
            className={`p-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer text-center ${
              category === "Physical" 
                ? "bg-red-950/20 border-red-800 text-red-500" 
                : "bg-zinc-900 border-zinc-800 text-zinc-455"
            }`}
          >
            {category}
          </button>
        </div>
      </div>

      {/* Item & Stat Stage adjustments */}
      <div className="grid grid-cols-2 gap-4 items-end font-mono">
        {/* Item Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Attacker Item Boost</label>
          <select 
            value={heldItem} 
            onChange={(e) => setHeldItem(e.target.value)}
            className="bg-zinc-900 border border-zinc-850 text-xs font-black text-zinc-300 p-2 rounded-xl focus:outline-none cursor-pointer uppercase tracking-wider"
          >
            <option value="None">None</option>
            <option value="Life Orb">Life Orb (1.3x)</option>
            <option value="Choice Band">Choice Band (1.5x Phys)</option>
            <option value="Choice Specs">Choice Specs (1.5x Spec)</option>
          </select>
        </div>

        {/* Def Max Stats toggle */}
        <div className="flex items-center justify-between h-9 bg-zinc-900 border border-zinc-850 p-2 rounded-xl select-none">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Def Max Stats</span>
          <input 
            type="checkbox" 
            checked={defenderMaxStats}
            onChange={(e) => setDefenderMaxStats(e.target.checked)}
            className="w-4 h-4 accent-red-650 bg-zinc-950 border border-zinc-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Stat stages adjusters */}
      <div className="grid grid-cols-2 gap-4 font-mono">
        {/* Attacker Attack Stage */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Atk/SpA Stage</label>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setAttackerStage(prev => Math.max(-6, prev - 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400 cursor-pointer"
            >
              -
            </button>
            <span className={`text-[10px] font-bold min-w-[24px] text-center ${attackerStage > 0 ? "text-emerald-500" : attackerStage < 0 ? "text-red-500" : "text-zinc-400"}`}>
              {attackerStage > 0 ? `+${attackerStage}` : attackerStage}
            </span>
            <button
              onClick={() => setAttackerStage(prev => Math.min(6, prev + 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* Defender Defense Stage */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Def/SpD Stage</label>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setDefenderStage(prev => Math.max(-6, prev - 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400 cursor-pointer"
            >
              -
            </button>
            <span className={`text-[10px] font-bold min-w-[24px] text-center ${defenderStage > 0 ? "text-emerald-500" : defenderStage < 0 ? "text-red-500" : "text-zinc-400"}`}>
              {defenderStage > 0 ? `+${defenderStage}` : defenderStage}
            </span>
            <button
              onClick={() => setDefenderStage(prev => Math.min(6, prev + 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Auto Matchup State Summary */}
      <div className="flex items-center justify-between text-[8px] font-bold text-zinc-550 uppercase tracking-widest border-t border-zinc-900 pt-3 font-mono">
        <span>STAB Multiplier: {isStab ? "1.5x" : "1.0x"}</span>
        <span>Type Effectiveness: {effectiveness}x</span>
      </div>

      {/* Output Display Ribbon */}
      {result && (
        <div className={`w-full rounded-2xl border p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
          result.minPercent >= 100 
            ? 'bg-red-950/20 border-red-900/60 shadow-[inset_0_1px_1px_rgba(220,38,38,0.05)]' 
            : 'bg-zinc-900/60 border-zinc-850'
        }`}>
          <div className="text-2xl font-black tracking-tighter text-white drop-shadow-sm flex items-center gap-1 font-mono">
            <span className="text-red-500 font-black text-2xl">{result.minPercent}% - {result.maxPercent}%</span>
          </div>

          {/* KO Chance Output */}
          <div className="text-[10px] font-black text-white uppercase tracking-widest mt-1.5 font-mono">
            {koChanceText}
          </div>

          <div className="text-[8px] font-bold text-zinc-550 uppercase tracking-widest mt-1 font-mono">
            {result.minDamage} - {result.maxDamage} HP (Def HP: {result.defenderMaxHP})
          </div>

          <div className="text-[8px] font-bold text-zinc-650 uppercase tracking-widest mt-0.5 font-mono">
            Atk: {result.attackerStat} | Def: {result.defenderStat}
          </div>

          {/* Progress Bar Visual */}
          <div className="w-full bg-zinc-950 h-2 mt-3.5 rounded-full overflow-hidden relative border border-zinc-900">
            <div 
              className="absolute top-0 left-0 h-full bg-red-500/35 transition-all duration-500" 
              style={{ width: `${Math.min(100, result.maxPercent)}%` }} 
            />
            <div 
              className="absolute top-0 left-0 h-full bg-red-500 transition-all duration-500" 
              style={{ width: `${Math.min(100, result.minPercent)}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

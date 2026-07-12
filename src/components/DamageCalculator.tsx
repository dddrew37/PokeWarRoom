"use client";

import { useState, useMemo, useEffect } from "react";
import { ParsedPokemon } from "../lib/parser";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { calculateDamage, lookupBaseStats, DamageModifiers } from "../lib/damage";

interface DamageCalculatorProps {
  playerMons: ParsedPokemon[];
  opponentMons: Pokemon[];
}

export default function DamageCalculator({ playerMons, opponentMons }: DamageCalculatorProps) {
  // Attacker selections (filtered from Player brought Pokémon)
  const [attackerIndex, setAttackerIndex] = useState<number>(0);
  // Defender selections (filtered from Opponent roster)
  const [defenderIndex, setDefenderIndex] = useState<number>(0);

  const [basePower, setBasePower] = useState<number>(80);
  const [category, setCategory] = useState<"Physical" | "Special">("Physical");
  const [effectiveness, setEffectiveness] = useState<number>(1.0);
  const [isStab, setIsStab] = useState<boolean>(true);
  const [heldItem, setHeldItem] = useState<string>("None");
  const [defenderMaxStats, setDefenderMaxStats] = useState<boolean>(true);
  
  // Stat stages for attacker/defender
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
            <select 
              value={attackerIndex} 
              onChange={(e) => setAttackerIndex(parseInt(e.target.value))}
              className="bg-transparent text-xs font-black text-white focus:outline-none w-full cursor-pointer uppercase tracking-wider font-mono"
            >
              {playerMons.map((mon, i) => (
                <option key={`atk-${i}`} value={i} className="bg-zinc-900 text-zinc-300 font-bold">{mon.name}</option>
              ))}
            </select>
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
            <select 
              value={defenderIndex} 
              onChange={(e) => setDefenderIndex(parseInt(e.target.value))}
              className="bg-transparent text-xs font-black text-white focus:outline-none w-full cursor-pointer uppercase tracking-wider font-mono"
            >
              {opponentMons.map((mon, i) => (
                <option key={`def-${i}`} value={i} className="bg-zinc-900 text-zinc-300 font-bold">{mon.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Move power and category */}
      <div className="grid grid-cols-2 gap-4 items-end font-mono">
        <div className="flex gap-2">
          {/* Base Power input */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Base Power</label>
            <input 
              type="number" 
              value={basePower}
              onChange={(e) => setBasePower(Math.max(0, parseInt(e.target.value) || 0))}
              className="bg-zinc-900 border border-zinc-850 text-white text-xs font-black p-2 rounded-xl w-full text-center focus:outline-none focus:border-red-900"
            />
          </div>

          {/* Category Selector */}
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Category</label>
            <button
              onClick={() => setCategory(category === "Physical" ? "Special" : "Physical")}
              className={`p-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                category === "Physical" 
                  ? "bg-red-950/20 border-red-800 text-red-500" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              }`}
            >
              {category}
            </button>
          </div>
        </div>

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
      </div>

      {/* Stat stages adjusters */}
      <div className="grid grid-cols-2 gap-4 font-mono">
        {/* Attacker Attack Stage */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Atk/SpA Stage</label>
          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => setAttackerStage(prev => Math.max(-6, prev - 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400"
            >
              -
            </button>
            <span className={`text-[10px] font-bold min-w-[24px] text-center ${attackerStage > 0 ? "text-emerald-500" : attackerStage < 0 ? "text-red-500" : "text-zinc-400"}`}>
              {attackerStage > 0 ? `+${attackerStage}` : attackerStage}
            </span>
            <button
              onClick={() => setAttackerStage(prev => Math.min(6, prev + 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400"
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
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400"
            >
              -
            </button>
            <span className={`text-[10px] font-bold min-w-[24px] text-center ${defenderStage > 0 ? "text-emerald-500" : defenderStage < 0 ? "text-red-500" : "text-zinc-400"}`}>
              {defenderStage > 0 ? `+${defenderStage}` : defenderStage}
            </span>
            <button
              onClick={() => setDefenderStage(prev => Math.min(6, prev + 1))}
              className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-xs font-black text-zinc-400"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Modifiers row */}
      <div className="flex items-center justify-between gap-4 font-mono">
        {/* STAB checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={isStab}
            onChange={(e) => setIsStab(e.target.checked)}
            className="w-3.5 h-3.5 accent-red-650 bg-zinc-900 border border-zinc-800 rounded focus:ring-0 cursor-pointer"
          />
          <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest">STAB Bonus</span>
        </label>

        {/* Max defense checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={defenderMaxStats}
            onChange={(e) => setDefenderMaxStats(e.target.checked)}
            className="w-3.5 h-3.5 accent-red-650 bg-zinc-900 border border-zinc-800 rounded focus:ring-0 cursor-pointer"
          />
          <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest">Def Max Stats</span>
        </label>
      </div>

      {/* Type Effectiveness row */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center font-mono">Type Effectiveness</label>
        <div className="flex bg-zinc-900 border border-zinc-850 rounded-xl p-0.5 font-mono">
          {[0, 0.25, 0.5, 1, 2, 4].map((mult) => (
            <button
              key={mult}
              onClick={() => setEffectiveness(mult)}
              className={`flex-1 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                effectiveness === mult 
                  ? mult > 1 
                    ? "bg-red-750 text-white shadow-md border border-red-500" 
                    : mult < 1 
                      ? "bg-zinc-850 text-zinc-400 border border-zinc-750 shadow-md" 
                      : "bg-zinc-700 text-white shadow-md"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              x{mult}
            </button>
          ))}
        </div>
      </div>

      {/* Output Display Ribbon */}
      {result && (
        <div className={`w-full rounded-2xl border p-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 ${
          result.isGuaranteedOHKO 
            ? 'bg-red-950/20 border-red-900/60 shadow-[inset_0_1px_1px_rgba(220,38,38,0.05)]' 
            : 'bg-zinc-900/60 border-zinc-850'
        }`}>
          <div className="text-2xl font-black tracking-tighter text-white drop-shadow-sm flex items-center gap-1">
            <span className="text-red-500 font-black text-2xl">{result.minPercent}% - {result.maxPercent}%</span>
          </div>

          <div className="text-[8px] font-bold text-zinc-550 uppercase tracking-widest mt-1 font-mono">
            {result.minDamage} - {result.maxDamage} HP (Def HP: {result.defenderMaxHP})
          </div>

          <div className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest mt-0.5 font-mono">
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

          {/* OHKO Status Badge */}
          {result.isGuaranteedOHKO && (
            <div className="mt-3.5 w-full bg-red-750 border border-red-500 text-white px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest text-center shadow-[0_0_12px_rgba(220,38,38,0.35)] animate-pulse font-mono">
              Guaranteed OHKO
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { ParsedPokemon } from "../lib/parser";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { calculateStats, calculateDamage, DamageModifiers } from "../utils/damageCalc";

interface DamageCalculatorProps {
  playerMons: ParsedPokemon[];
  opponentMons: Pokemon[];
}

export default function DamageCalculator({ playerMons, opponentMons }: DamageCalculatorProps) {
  const activeSlots = useMemo(() => {
    return [
      ...playerMons.map((p, i) => ({ ...p, side: 'player' as const, key: `p-${i}` })),
      ...opponentMons.map((p, i) => ({ ...p, side: 'opponent' as const, key: `o-${i}` }))
    ];
  }, [playerMons, opponentMons]);

  const [attackerKey, setAttackerKey] = useState<string>(activeSlots[0]?.key || "");
  const [defenderKey, setDefenderKey] = useState<string>(activeSlots.find(s => s.side !== activeSlots[0]?.side)?.key || "");
  const [basePower, setBasePower] = useState<number>(80);
  const [category, setCategory] = useState<"Physical" | "Special">("Physical");
  const [modifiers, setModifiers] = useState<DamageModifiers>({
    stab: false,
    spread: false,
    typeEffectiveness: 1,
  });

  const attacker = activeSlots.find(s => s.key === attackerKey);
  const defender = activeSlots.find(s => s.key === defenderKey);

  const result = useMemo(() => {
    if (!attacker || !defender) return null;
    
    // Assume max offensive stat for opponent if they are attacking
    const attackerStats = calculateStats(attacker, attacker.side, true);
    // Assume max defensive stat for opponent if they are defending
    const defenderStats = calculateStats(defender, defender.side, true);

    return calculateDamage(attackerStats, defenderStats, basePower, category, modifiers);
  }, [attacker, defender, basePower, category, modifiers]);

  const handleEffectivenessChange = (val: number) => {
    setModifiers(prev => ({ ...prev, typeEffectiveness: val }));
  };

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-inner mt-4 mb-4 flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
          </svg>
          Rapid-Fire Damage Calc
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Attacker Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Attacker</label>
          <div className="flex items-center gap-3">
            <img 
              src={(attacker as any)?.spriteUrl || `https://play.pokemonshowdown.com/sprites/gen5/${attacker?.id}.png`} 
              className="w-12 h-12 object-contain bg-zinc-900 border border-zinc-700 rounded-lg"
              onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
            />
            <select 
              value={attackerKey} 
              onChange={(e) => setAttackerKey(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white text-sm font-bold p-2 rounded-lg w-full focus:outline-none focus:border-red-500"
            >
              {activeSlots.map(slot => (
                <option key={`atk-${slot.key}`} value={slot.key}>{slot.name} ({slot.side})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Defender Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Defender</label>
          <div className="flex items-center gap-3">
            <img 
              src={(defender as any)?.spriteUrl || `https://play.pokemonshowdown.com/sprites/gen5/${defender?.id}.png`} 
              className="w-12 h-12 object-contain bg-zinc-900 border border-zinc-700 rounded-lg"
              onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
            />
            <select 
              value={defenderKey} 
              onChange={(e) => setDefenderKey(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white text-sm font-bold p-2 rounded-lg w-full focus:outline-none focus:border-blue-500"
            >
              {activeSlots.map(slot => (
                <option key={`def-${slot.key}`} value={slot.key}>{slot.name} ({slot.side})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 items-end">
        {/* Move Stats */}
        <div className="flex gap-4">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Base Power</label>
            <input 
              type="number" 
              value={basePower}
              onChange={(e) => setBasePower(parseInt(e.target.value) || 0)}
              className="bg-zinc-900 border border-zinc-700 text-white text-sm font-black p-2 rounded-lg w-full text-center focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Category</label>
            <button
              onClick={() => setCategory(category === "Physical" ? "Special" : "Physical")}
              className={`p-2 rounded-lg text-xs font-black uppercase tracking-wider border-2 transition-all ${
                category === "Physical" 
                  ? "bg-red-900/20 border-red-500 text-red-400" 
                  : "bg-zinc-950 border-zinc-800 text-zinc-400"
              }`}
            >
              {category}
            </button>
          </div>
        </div>

        {/* Modifiers */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Modifiers</label>
          <div className="flex gap-2">
            <button
              onClick={() => setModifiers(prev => ({ ...prev, stab: !prev.stab }))}
              className={`flex-1 p-2 rounded-lg text-xs font-black border-2 transition-all ${
                modifiers.stab ? "bg-red-950/20 border-red-600 text-red-500" : "bg-zinc-900 border-zinc-700 text-zinc-400"
              }`}
            >
              STAB
            </button>
            <button
              onClick={() => setModifiers(prev => ({ ...prev, spread: !prev.spread }))}
              className={`flex-1 p-2 rounded-lg text-xs font-black border-2 transition-all ${
                modifiers.spread ? "bg-red-950/20 border-red-600 text-red-500" : "bg-zinc-900 border-zinc-700 text-zinc-400"
              }`}
            >
              SPREAD
            </button>
          </div>
        </div>
      </div>

      {/* Type Effectiveness Pills */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Type Effectiveness</label>
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {[0.25, 0.5, 1, 2, 4].map((multiplier) => (
            <button
              key={multiplier}
              onClick={() => handleEffectivenessChange(multiplier)}
              className={`flex-1 py-1.5 rounded-md text-xs font-black transition-all ${
                modifiers.typeEffectiveness === multiplier 
                  ? multiplier > 1 ? "bg-red-700 text-white shadow-md border border-red-500" : multiplier < 1 ? "bg-zinc-800 text-zinc-400 border border-zinc-700 shadow-md" : "bg-zinc-600 text-white shadow-md"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              x{multiplier}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Output Ribbon */}
      {result && (
        <div className={`w-full rounded-xl border p-4 flex flex-col items-center justify-center relative overflow-hidden ${
          result.minPercent >= 100 ? 'bg-red-950/20 border-red-900/40' :
          result.maxPercent >= 100 ? 'bg-red-950/10 border-red-900/20' :
          'bg-zinc-900 border-zinc-750'
        }`}>
          <div className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: result.minPercent >= 100 ? '#ef4444' : result.maxPercent >= 100 ? '#ef4444' : '#a1a1aa' }}>
            {result.koChance}
          </div>
          <div className="text-2xl font-black text-white drop-shadow-sm">
            {result.minPercent}% - {result.maxPercent}%
          </div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            {result.minDamage} - {result.maxDamage} HP
          </div>
          
          {/* Progress Bar Background */}
          <div className="w-full bg-zinc-950 h-2 mt-4 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-red-500/30" 
              style={{ width: `${Math.min(100, result.maxPercent)}%` }} 
            />
            <div 
              className="absolute top-0 left-0 h-full bg-red-500" 
              style={{ width: `${Math.min(100, result.minPercent)}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

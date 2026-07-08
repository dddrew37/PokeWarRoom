"use client";

import { useState, useMemo } from "react";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { ParsedPokemon } from "../lib/parser";
import metaData from "../data/meta_data.json";

interface Modifiers {
  tailwind: boolean;
  choiceScarf: boolean;
  statStage: number;
  isMaxSpeed: boolean;
}

interface SpeedBoardProps {
  playerMons: ParsedPokemon[];
  opponentMons: Pokemon[];
}

export default function SpeedBoard({ playerMons, opponentMons }: SpeedBoardProps) {
  const [isTrickRoom, setIsTrickRoom] = useState(false);
  const [mods, setMods] = useState<Record<string, Modifiers>>({});

  const getMod = (key: string) => mods[key] || { tailwind: false, choiceScarf: false, statStage: 0, isMaxSpeed: false };
  const updateMod = (key: string, updates: Partial<Modifiers>) => {
    setMods(prev => ({ ...prev, [key]: { ...getMod(key), ...updates } }));
  };

  const activeSlots = useMemo(() => {
    const slots = [
      ...playerMons.map((p, i) => ({ ...p, side: 'player' as const, key: `p-${i}` })),
      ...opponentMons.map((p, i) => ({ ...p, side: 'opponent' as const, key: `o-${i}` }))
    ];

    const withSpeeds = slots.map(slot => {
      const normalizedInput = slot.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const metaMon = (metaData.pokemon as any[]).find((m: any) => 
        m.id === normalizedInput || m.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === normalizedInput
      );
      const baseSpeed = metaMon?.baseStats?.spe || 100;
      
      let evs = 0;
      let natureMod = 1.0;
      const m = getMod(slot.key);

      if (slot.side === 'player') {
        const parsed = slot as ParsedPokemon;
        evs = (parsed.sp?.spe || 0) * 8;
        const n = (parsed.nature || '').toLowerCase();
        if (['jolly', 'timid', 'naive', 'hasty'].includes(n)) natureMod = 1.1;
        if (['brave', 'relaxed', 'quiet', 'sassy'].includes(n)) natureMod = 0.9;
      } else {
        if (m.isMaxSpeed) {
          evs = 252;
          natureMod = 1.1; // assumes beneficial nature for max speed toggle
        }
      }

      let rawStat = Math.floor((((2 * baseSpeed + 31 + Math.floor(evs / 4)) * 50) / 100) + 5);
      let stat = Math.floor(rawStat * natureMod);

      if (m.choiceScarf) stat = Math.floor(stat * 1.5);
      if (m.tailwind) stat = Math.floor(stat * 2);

      const stage = m.statStage;
      let stageMod = 1;
      if (stage > 0) stageMod = (2 + stage) / 2;
      else if (stage < 0) stageMod = 2 / (2 - stage);

      stat = Math.floor(stat * stageMod);

      return {
        ...slot,
        baseSpeed,
        speed: stat,
        modState: m
      };
    });

    // Sort by effective speed
    withSpeeds.sort((a, b) => isTrickRoom ? a.speed - b.speed : b.speed - a.speed);
    
    // Assign horizontal position indices
    return withSpeeds.map((s, index) => ({ ...s, positionIndex: index }));
  }, [playerMons, opponentMons, isTrickRoom, mods]);

  return (
    <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-inner mt-8 mb-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Dynamic Speed Board
          </h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Live Turn Order Calculation</p>
        </div>
        <button 
          onClick={() => setIsTrickRoom(!isTrickRoom)}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 ${
            isTrickRoom 
              ? 'bg-purple-900/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          {isTrickRoom ? "Trick Room Active" : "Normal Gravity"}
        </button>
      </div>

      <div className="relative h-48 w-full">
        {activeSlots.map((slot) => {
          // Calculate left percentage to glide avatars
          const leftPos = `calc(${(slot.positionIndex / (activeSlots.length - 1 || 1)) * 100}% - ${(slot.positionIndex / (activeSlots.length - 1 || 1)) * 140}px)`;
          
          return (
            <div 
              key={slot.key}
              className="absolute top-0 w-[140px] transition-all duration-500 ease-in-out flex flex-col items-center"
              style={{ left: leftPos }}
            >
              <div className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl p-2 flex flex-col items-center gap-2 shadow-lg relative group">
                {/* Speed Badge */}
                <div className={`absolute -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-sm ${
                  slot.side === 'player' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {slot.speed}
                </div>
                
                <img 
                  src={(slot as any).spriteUrl || `https://play.pokemonshowdown.com/sprites/gen5/${slot.id}.png`} 
                  alt={slot.name} 
                  className="w-16 h-16 object-contain drop-shadow-md mt-1"
                  onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                />
                
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest truncate w-full text-center px-1">
                  {slot.name}
                </span>

                {/* Micro Toggles */}
                <div className="flex flex-wrap justify-center gap-1 mt-1 w-full opacity-60 hover:opacity-100 transition-opacity">
                  {slot.side === 'opponent' && (
                    <button 
                      onClick={() => updateMod(slot.key, { isMaxSpeed: !slot.modState.isMaxSpeed })}
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${slot.modState.isMaxSpeed ? 'bg-amber-900/50 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-700 text-zinc-500'}`}
                      title="Max Speed"
                    >
                      MAX
                    </button>
                  )}
                  <button 
                    onClick={() => updateMod(slot.key, { choiceScarf: !slot.modState.choiceScarf })}
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${slot.modState.choiceScarf ? 'bg-blue-900/50 border-blue-500 text-blue-400' : 'bg-zinc-950 border-zinc-700 text-zinc-500'}`}
                    title="Choice Scarf"
                  >
                    SCF
                  </button>
                  <button 
                    onClick={() => updateMod(slot.key, { tailwind: !slot.modState.tailwind })}
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${slot.modState.tailwind ? 'bg-cyan-900/50 border-cyan-500 text-cyan-400' : 'bg-zinc-950 border-zinc-700 text-zinc-500'}`}
                    title="Tailwind"
                  >
                    TW
                  </button>
                  <div className="flex items-center gap-[1px]">
                    <button 
                      onClick={() => updateMod(slot.key, { statStage: Math.max(-6, slot.modState.statStage - 1) })}
                      className="bg-zinc-950 border border-zinc-700 text-zinc-400 hover:text-white px-1.5 py-0.5 rounded-l text-[9px] font-black"
                    >
                      -
                    </button>
                    <span className="bg-zinc-900 border-y border-zinc-700 text-zinc-300 px-1 py-0.5 text-[9px] font-black min-w-[20px] text-center">
                      {slot.modState.statStage > 0 ? `+${slot.modState.statStage}` : slot.modState.statStage}
                    </span>
                    <button 
                      onClick={() => updateMod(slot.key, { statStage: Math.min(6, slot.modState.statStage + 1) })}
                      className="bg-zinc-950 border border-zinc-700 text-zinc-400 hover:text-white px-1.5 py-0.5 rounded-r text-[9px] font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

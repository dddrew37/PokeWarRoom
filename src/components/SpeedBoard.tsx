"use client";

import { useMemo } from "react";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { ParsedPokemon } from "../lib/parser";
import { determineTurnOrder, BattleFieldState, lookupBaseSpeed } from "../lib/speed";

interface SpeedBoardProps {
  playerMons: ParsedPokemon[];
  opponentMons: Pokemon[];
  isTrickRoom: boolean;
  playerTailwind: boolean;
  opponentTailwind: boolean;
  weather: string;
  speedStages: Record<string, number>;
  choiceScarfs: Record<string, boolean>;
  opponentMaxSpeeds: Record<string, boolean>;
  onUpdateSpeedStage: (key: string, newStage: number) => void;
  onUpdateChoiceScarf: (key: string, value: boolean) => void;
  onUpdateMaxSpeed?: (key: string, value: boolean) => void;
}

export default function SpeedBoard({
  playerMons,
  opponentMons,
  isTrickRoom,
  playerTailwind,
  opponentTailwind,
  weather,
  speedStages,
  choiceScarfs,
  opponentMaxSpeeds,
  onUpdateSpeedStage,
  onUpdateChoiceScarf,
  onUpdateMaxSpeed,
}: SpeedBoardProps) {

  // Map slot positions to BattleFieldState and calculate final speeds using our typescript engine
  const activeSlots = useMemo(() => {
    const pSlots = playerMons.slice(0, 2).map((p, i) => {
      const key = `p-${i}`;
      const baseSpeed = lookupBaseSpeed(p.name);
      
      // Calculate EVs from 66-SP math structure
      const speEvs = p.sp?.spe !== undefined ? p.sp.spe * 8 : 0;
      
      // Parse Nature multiplier
      let natureMod = 1.0;
      if (p.nature) {
        const n = p.nature.toLowerCase().trim();
        if (["jolly", "timid", "naive", "hasty"].includes(n)) natureMod = 1.1;
        if (["brave", "relaxed", "quiet", "sassy"].includes(n)) natureMod = 0.9;
      }

      return {
        name: p.name,
        id: p.id,
        baseSpeed,
        evs: speEvs,
        natureModifier: natureMod,
        item: p.item,
        ability: p.ability,
        side: "player" as const,
        key,
        // Environment details
        isTrickRoom,
        weather,
        isTurn1: true,
        modifiers: {
          tailwind: playerTailwind,
          choiceScarf: choiceScarfs[key] || false,
          statStage: speedStages[key] || 0,
          weather,
          pokemonName: p.name,
          item: p.item,
          ability: p.ability,
        }
      };
    });

    const oSlots = opponentMons.slice(0, 2).map((p, i) => {
      const key = `o-${i}`;
      const baseSpeed = lookupBaseSpeed(p.name);
      const isMax = opponentMaxSpeeds[key] || false;
      const isScarf = choiceScarfs[key] || false;

      return {
        name: p.name,
        id: p.id,
        baseSpeed,
        evs: isMax ? 252 : 0,
        natureModifier: isMax ? 1.1 : 1.0, // Assuming speed boosting nature for Max Speed
        side: "opponent" as const,
        key,
        // Environment details
        isTrickRoom,
        weather,
        isTurn1: true,
        modifiers: {
          tailwind: opponentTailwind,
          choiceScarf: isScarf,
          statStage: speedStages[key] || 0,
          weather,
          pokemonName: p.name,
        }
      };
    });

    const merged = [...pSlots, ...oSlots];
    
    // Sort slots by turn order using our core math engine
    const sorted = determineTurnOrder({
      activePokemon: merged as any[],
      isTrickRoom,
      weather,
      isTurn1: true
    });

    // Map sorted order back to their positions for animations
    return sorted.map((slot: any, index) => ({
      ...slot,
      positionIndex: index,
    }));
  }, [
    playerMons,
    opponentMons,
    isTrickRoom,
    playerTailwind,
    opponentTailwind,
    weather,
    speedStages,
    choiceScarfs,
    opponentMaxSpeeds,
  ]);

  return (
    <div className="w-full bg-zinc-950 border border-red-950/40 rounded-2xl p-6 shadow-inner relative overflow-hidden">
      {/* Visual background elements */}
      <div className="absolute top-0 right-0 w-32 h-full bg-red-700/5 blur-3xl pointer-events-none" />
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isTrickRoom ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" : "bg-red-500 animate-pulse"}`} />
            Live Speed Timeline
          </h3>
          <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono mt-1">Real-Time Turn Order Simulation</p>
        </div>
        
        {/* Environmental Indicators */}
        <div className="flex items-center gap-2">
          {isTrickRoom && (
            <span className="px-2 py-0.5 bg-purple-950/30 text-purple-400 border border-purple-900/50 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              TR ACTIVE
            </span>
          )}
          {(playerTailwind || opponentTailwind) && (
            <span className="px-2 py-0.5 bg-cyan-950/30 text-cyan-400 border border-cyan-900/50 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              TAILWIND ACTIVE
            </span>
          )}
          {weather !== "none" && (
            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md ${
              weather === "rain" 
                ? "bg-blue-950/30 text-blue-450 border border-blue-900/50" 
                : "bg-amber-950/30 text-amber-500 border border-amber-900/50"
            }`}>
              WEATHER: {weather}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-56 w-full mt-2">
        {activeSlots.map((slot) => {
          // Calculate left position for sliding transition
          const leftPos = `calc(${(slot.positionIndex / (activeSlots.length - 1 || 1)) * 100}% - ${(slot.positionIndex / (activeSlots.length - 1 || 1)) * 130}px)`;
          const isPlayer = slot.side === "player";
          const isTWActive = isPlayer ? playerTailwind : opponentTailwind;
          const stageVal = speedStages[slot.key] || 0;

          return (
            <div
              key={slot.key}
              className="absolute top-0 w-[130px] transition-all duration-500 ease-in-out flex flex-col items-center"
              style={{ left: leftPos }}
            >
              <div className={`w-full bg-zinc-950 border-2 rounded-xl p-2.5 flex flex-col items-center gap-1.5 shadow-xl relative group transition-all duration-300 ${
                isTrickRoom 
                  ? "border-purple-900/60 shadow-[0_0_12px_rgba(168,85,247,0.1)] hover:border-purple-500/80" 
                  : isPlayer
                    ? "border-zinc-900 hover:border-red-900/60"
                    : "border-zinc-900 hover:border-red-950"
              }`}>
                {/* Speed Badge */}
                <div className={`absolute -top-3.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black border tracking-wider shadow-md transition-all ${
                  isPlayer
                    ? "bg-red-950/90 border-red-900 text-red-500 shadow-[0_0_8px_rgba(220,38,38,0.15)]"
                    : "bg-zinc-900 border-zinc-800 text-zinc-350"
                }`}>
                  {slot.modifiedSpeed || 0}
                </div>

                {/* Tailwind Indicator */}
                {isTWActive && (
                  <div className="absolute top-2 left-2 bg-cyan-950/60 border border-cyan-900 text-cyan-400 p-0.5 rounded-md text-[8px] font-black flex items-center gap-0.5 shadow-sm" title="Tailwind Boosted">
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}

                {/* Pokemon Sprite */}
                <img
                  src={slot.spriteUrl || `https://play.pokemonshowdown.com/sprites/gen5/${slot.id}.png`}
                  alt={slot.name}
                  className="w-14 h-14 object-contain drop-shadow-md mt-1 transition-transform group-hover:scale-110"
                  onError={(e) => {
                    e.currentTarget.src = POKEBALL_FALLBACK;
                  }}
                />

                {/* Name */}
                <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest truncate w-full text-center px-1 font-mono">
                  {slot.name}
                </span>

                {/* Speed Stages Adjusters */}
                <div className="flex items-center gap-[1px] mt-1">
                  <button
                    onClick={() => onUpdateSpeedStage(slot.key, Math.max(-6, stageVal - 1))}
                    className="bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900 text-zinc-550 hover:text-red-500 px-1.5 py-0.5 rounded-l text-[9px] font-black transition-colors"
                  >
                    -
                  </button>
                  <span className={`bg-zinc-950 border-y border-zinc-800 text-[8px] font-bold px-1.5 py-0.5 min-w-[22px] text-center font-mono ${
                    stageVal > 0 
                      ? "text-emerald-500" 
                      : stageVal < 0 
                        ? "text-red-500" 
                        : "text-zinc-400"
                  }`}>
                    {stageVal > 0 ? `+${stageVal}` : stageVal}
                  </span>
                  <button
                    onClick={() => onUpdateSpeedStage(slot.key, Math.min(6, stageVal + 1))}
                    className="bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900 text-zinc-550 hover:text-red-500 px-1.5 py-0.5 rounded-r text-[9px] font-black transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Micro Toggles */}
                <div className="flex gap-1 mt-1.5 w-full justify-center">
                  <button
                    onClick={() => onUpdateChoiceScarf(slot.key, !(choiceScarfs[slot.key] || false))}
                    className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-colors tracking-widest font-mono ${
                      choiceScarfs[slot.key]
                        ? "bg-red-950/40 border-red-900 text-red-500 shadow-[0_0_8px_rgba(220,38,38,0.2)]"
                        : "bg-zinc-950 border-zinc-900 text-zinc-600 hover:text-zinc-400 hover:border-zinc-800"
                    }`}
                    title="Toggle Choice Scarf"
                  >
                    SCARF
                  </button>

                  {slot.side === "opponent" && onUpdateMaxSpeed && (
                    <button
                      onClick={() => onUpdateMaxSpeed(slot.key, !(opponentMaxSpeeds[slot.key] || false))}
                      className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-colors tracking-widest font-mono ${
                        opponentMaxSpeeds[slot.key]
                          ? "bg-amber-950/40 border-amber-900 text-amber-500"
                          : "bg-zinc-950 border-zinc-900 text-zinc-650 hover:text-zinc-400 hover:border-zinc-800"
                      }`}
                      title="Toggle Max Speed"
                    >
                      MAX
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

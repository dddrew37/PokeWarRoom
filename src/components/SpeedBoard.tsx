"use client";

import { useMemo, useState } from "react";
import { Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { ParsedPokemon } from "../lib/parser";
import { lookupBaseSpeed, calculateModifiedSpeed } from "../lib/speed";

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
  // Optional callbacks so the SpeedBoard can host its own toggle controls
  onToggleTrickRoom?: () => void;
  onTogglePlayerTailwind?: () => void;
  onToggleOpponentTailwind?: () => void;
}

interface SpeedSlot {
  name: string;
  id: string;
  key: string;
  side: "player" | "opponent";
  baseSpeed: number;
  modifiedSpeed: number;
  item: string;
  ability: string;
  positionIndex: number;
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
  onToggleTrickRoom,
  onTogglePlayerTailwind,
  onToggleOpponentTailwind,
}: SpeedBoardProps) {

  // Collapsed / expanded state for the control panel
  const [showControls, setShowControls] = useState(true);

  // Build slot array and calculate speeds via the speed.ts engine
  const activeSlots: SpeedSlot[] = useMemo(() => {
    const slots: SpeedSlot[] = [];

    playerMons.slice(0, 2).forEach((p, i) => {
      const key = `p-${i}`;
      const baseSpeed = lookupBaseSpeed(p.name);

      // Derive Speed EVs from SP math
      const speEvs = p.sp?.spe !== undefined ? p.sp.spe * 8 : 0;

      // Nature modifier
      let natureMod = 1.0;
      if (p.nature) {
        const n = p.nature.toLowerCase().trim();
        if (["jolly", "timid", "naive", "hasty"].includes(n)) natureMod = 1.1;
        if (["brave", "relaxed", "quiet", "sassy"].includes(n)) natureMod = 0.9;
      }

      const modifiedSpeed = calculateModifiedSpeed(baseSpeed, {
        tailwind: playerTailwind,
        choiceScarf: choiceScarfs[key] || false,
        statStage: speedStages[key] || 0,
        weather,
        pokemonName: p.name,
        item: p.item,
        ability: p.ability,
        evs: speEvs,
        ivs: 31,
        natureModifier: natureMod,
        isTurn1: true,
      });

      slots.push({
        name: p.name,
        id: p.id,
        key,
        side: "player",
        baseSpeed,
        modifiedSpeed,
        item: p.item,
        ability: p.ability,
        positionIndex: 0,
      });
    });

    opponentMons.slice(0, 2).forEach((p, i) => {
      const key = `o-${i}`;
      const baseSpeed = lookupBaseSpeed(p.name);
      const isMax = opponentMaxSpeeds[key] || false;
      const isScarf = choiceScarfs[key] || false;

      const modifiedSpeed = calculateModifiedSpeed(baseSpeed, {
        tailwind: opponentTailwind,
        choiceScarf: isScarf,
        statStage: speedStages[key] || 0,
        weather,
        pokemonName: p.name,
        evs: isMax ? 252 : 0,
        ivs: 31,
        natureModifier: isMax ? 1.1 : 1.0,
        isTurn1: true,
      });

      slots.push({
        name: p.name,
        id: p.id,
        key,
        side: "opponent",
        baseSpeed,
        modifiedSpeed,
        item: "",
        ability: "",
        positionIndex: 0,
      });
    });

    // Sort: fastest first (descending), or slowest first if Trick Room
    const sorted = [...slots].sort((a, b) => {
      if (isTrickRoom) return a.modifiedSpeed - b.modifiedSpeed;
      return b.modifiedSpeed - a.modifiedSpeed;
    });

    return sorted.map((slot, idx) => ({ ...slot, positionIndex: idx }));
  }, [
    playerMons, opponentMons,
    isTrickRoom, playerTailwind, opponentTailwind,
    weather, speedStages, choiceScarfs, opponentMaxSpeeds,
  ]);

  // Count of active modifiers for the badge
  const activeModCount = [
    isTrickRoom, playerTailwind, opponentTailwind, weather !== "none",
  ].filter(Boolean).length;

  return (
    <div className="w-full bg-zinc-950 border border-red-950/40 rounded-2xl shadow-inner relative overflow-hidden">
      {/* Decorative Background Glow */}
      <div className="absolute top-0 right-0 w-40 h-full bg-red-700/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-700/5 blur-3xl pointer-events-none" />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center px-6 pt-5 pb-3 relative z-10">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full transition-colors ${
              isTrickRoom 
                ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" 
                : "bg-red-500 animate-pulse"
            }`} />
            Speed Timeline
          </h3>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono mt-1">
            {isTrickRoom ? "Trick Room Active -- Slowest Moves First" : "Standard -- Fastest Moves First"}
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-1.5">
          {isTrickRoom && (
            <span className="px-2 py-0.5 bg-purple-950/30 text-purple-400 border border-purple-900/50 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.2)]">
              TR
            </span>
          )}
          {playerTailwind && (
            <span className="px-2 py-0.5 bg-cyan-950/30 text-cyan-400 border border-cyan-900/50 rounded-lg text-[8px] font-black uppercase tracking-widest">
              P-TW
            </span>
          )}
          {opponentTailwind && (
            <span className="px-2 py-0.5 bg-red-950/30 text-red-400 border border-red-900/50 rounded-lg text-[8px] font-black uppercase tracking-widest">
              O-TW
            </span>
          )}
          {weather !== "none" && (
            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${
              weather === "rain" 
                ? "bg-blue-950/30 text-blue-400 border border-blue-900/50" 
                : "bg-amber-950/30 text-amber-500 border border-amber-900/50"
            }`}>
              {weather}
            </span>
          )}

          {/* Toggle Control Panel Button */}
          {(onToggleTrickRoom || onTogglePlayerTailwind || onToggleOpponentTailwind) && (
            <button
              onClick={() => setShowControls(!showControls)}
              className={`ml-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                showControls
                  ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
              title="Toggle field condition controls"
            >
              Controls{activeModCount > 0 ? ` (${activeModCount})` : ""}
            </button>
          )}
        </div>
      </div>

      {/* ── Inline Control Panel ─────────────────────────────────────────── */}
      {showControls && (onToggleTrickRoom || onTogglePlayerTailwind || onToggleOpponentTailwind) && (
        <div className="px-6 pb-3 relative z-10">
          <div className="flex flex-wrap items-center gap-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-3.5 py-2.5">
            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mr-1 font-mono">
              Field:
            </span>

            {onToggleTrickRoom && (
              <button
                onClick={onToggleTrickRoom}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                  isTrickRoom
                    ? "bg-purple-950/40 border-purple-800 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                Trick Room
              </button>
            )}

            {onTogglePlayerTailwind && (
              <button
                onClick={onTogglePlayerTailwind}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                  playerTailwind
                    ? "bg-cyan-950/40 border-cyan-800 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                Player Tailwind
              </button>
            )}

            {onToggleOpponentTailwind && (
              <button
                onClick={onToggleOpponentTailwind}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                  opponentTailwind
                    ? "bg-red-950/40 border-red-900 text-red-400 shadow-[0_0_10px_rgba(220,38,38,0.25)]"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                Opponent Tailwind
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Speed Timeline ───────────────────────────────────────────────── */}
      <div className="px-6 pb-5 relative z-10">
        {activeSlots.length === 0 ? (
          <div className="text-center py-10 text-zinc-600 text-[10px] font-black uppercase tracking-widest font-mono">
            Select leads to calculate turn order
          </div>
        ) : (
          <>
            {/* Connecting Timeline Track */}
            <div className="relative mb-3 mt-1">
              <div className="absolute top-1/2 left-6 right-6 h-[2px] bg-gradient-to-r from-red-900/40 via-zinc-800/60 to-red-900/40 -translate-y-1/2 rounded-full" />
              {/* Position Markers */}
              <div className="flex justify-between px-3">
                {activeSlots.map((_, idx) => (
                  <div key={idx} className="flex flex-col items-center z-10">
                    <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                      idx === 0
                        ? "bg-red-500 border-red-400 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
                        : "bg-zinc-800 border-zinc-700"
                    }`} />
                    <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-1 font-mono">
                      {isTrickRoom ? "Last" : "1st"}{idx > 0 ? "" : ""}
                      {idx === 0 ? "" : idx === activeSlots.length - 1 ? (isTrickRoom ? " / 1st" : " / Last") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pokemon Cards Row */}
            <div className="flex justify-between gap-3">
              {activeSlots.map((slot) => {
                const isPlayer = slot.side === "player";
                const stageVal = speedStages[slot.key] || 0;
                const isScarfActive = choiceScarfs[slot.key] || false;
                const isMaxActive = slot.side === "opponent" && (opponentMaxSpeeds[slot.key] || false);
                const isTWActive = isPlayer ? playerTailwind : opponentTailwind;

                return (
                  <div
                    key={slot.key}
                    className="flex-1 min-w-0 flex flex-col items-center transition-all duration-500 ease-in-out"
                  >
                    <div className={`w-full bg-zinc-950 border-2 rounded-xl p-2 flex flex-col items-center gap-1 shadow-xl relative group transition-all duration-300 ${
                      isTrickRoom
                        ? "border-purple-900/50 shadow-[0_0_10px_rgba(168,85,247,0.08)] hover:border-purple-500/70"
                        : isPlayer
                          ? "border-zinc-800/80 hover:border-red-900/60"
                          : "border-zinc-800/80 hover:border-zinc-600"
                    }`}>

                      {/* Speed Value Badge (top) */}
                      <div className={`absolute -top-3 px-2.5 py-0.5 rounded-lg text-[10px] font-black border tracking-wider shadow-md transition-all font-mono ${
                        isPlayer
                          ? "bg-red-950/90 border-red-900 text-red-400 shadow-[0_0_8px_rgba(220,38,38,0.15)]"
                          : "bg-zinc-900 border-zinc-700 text-zinc-300"
                      }`}>
                        {slot.modifiedSpeed}
                      </div>

                      {/* Modifier Indicator Badges (top-left corner) */}
                      <div className="absolute top-1 left-1 flex flex-col gap-[2px]">
                        {isTWActive && (
                          <div className="bg-cyan-950/70 border border-cyan-900/60 text-cyan-400 px-1 py-[1px] rounded text-[6px] font-black tracking-widest" title="Tailwind Active">
                            TW
                          </div>
                        )}
                        {isScarfActive && (
                          <div className="bg-red-950/70 border border-red-900/60 text-red-400 px-1 py-[1px] rounded text-[6px] font-black tracking-widest" title="Choice Scarf Active">
                            CS
                          </div>
                        )}
                        {isMaxActive && (
                          <div className="bg-amber-950/70 border border-amber-900/60 text-amber-400 px-1 py-[1px] rounded text-[6px] font-black tracking-widest" title="Max Speed Assumed">
                            MAX
                          </div>
                        )}
                      </div>

                      {/* Side Label (top-right) */}
                      <div className={`absolute top-1 right-1 text-[6px] font-black uppercase tracking-widest px-1 py-[1px] rounded ${
                        isPlayer ? "text-red-600" : "text-zinc-600"
                      }`}>
                        {isPlayer ? "YOU" : "OPP"}
                      </div>

                      {/* Pokemon Sprite */}
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/gen5/${slot.id}.png`}
                        alt={slot.name}
                        className="w-12 h-12 object-contain drop-shadow-md mt-3 transition-transform group-hover:scale-110"
                        onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                      />

                      {/* Pokemon Name */}
                      <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest truncate w-full text-center px-1 font-mono leading-tight">
                        {slot.name}
                      </span>

                      {/* Base Speed (dim label) */}
                      <span className="text-[7px] font-bold text-zinc-650 font-mono">
                        Base: {slot.baseSpeed}
                      </span>

                      {/* Calculated Speed Row */}
                      <div className="text-[9px] font-black text-red-500 font-mono mt-0.5 bg-red-950/30 border border-red-900/40 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm select-none">
                        <span>Speed:</span>
                        <span className="text-white font-bold">{slot.modifiedSpeed}</span>
                      </div>

                      {/* ── Speed Stage Adjuster ────────────────────────── */}
                      <div className="flex items-center gap-[1px] mt-1">
                        <button
                          onClick={() => onUpdateSpeedStage(slot.key, Math.max(-6, stageVal - 1))}
                          className="bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900 text-zinc-500 hover:text-red-500 px-1.5 py-0.5 rounded-l text-[9px] font-black transition-colors"
                        >
                          -
                        </button>
                        <span className={`bg-zinc-950 border-y border-zinc-800 text-[8px] font-bold px-1.5 py-0.5 min-w-[22px] text-center font-mono ${
                          stageVal > 0
                            ? "text-emerald-500"
                            : stageVal < 0
                              ? "text-red-500"
                              : "text-zinc-500"
                        }`}>
                          {stageVal > 0 ? `+${stageVal}` : stageVal}
                        </span>
                        <button
                          onClick={() => onUpdateSpeedStage(slot.key, Math.min(6, stageVal + 1))}
                          className="bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900 text-zinc-500 hover:text-red-500 px-1.5 py-0.5 rounded-r text-[9px] font-black transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* ── Micro Toggles Row ───────────────────────────── */}
                      <div className="flex gap-1 mt-1 w-full justify-center">
                        {/* Choice Scarf Toggle */}
                        <button
                          onClick={() => onUpdateChoiceScarf(slot.key, !isScarfActive)}
                          className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-colors tracking-widest font-mono ${
                            isScarfActive
                              ? "bg-red-950/40 border-red-900 text-red-500 shadow-[0_0_6px_rgba(220,38,38,0.2)]"
                              : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                          }`}
                          title="Toggle Choice Scarf (x1.5 Speed)"
                        >
                          SCARF
                        </button>

                        {/* Max Speed Toggle (Opponents Only) */}
                        {slot.side === "opponent" && onUpdateMaxSpeed && (
                          <button
                            onClick={() => onUpdateMaxSpeed(slot.key, !(opponentMaxSpeeds[slot.key] || false))}
                            className={`text-[7px] font-black px-1.5 py-0.5 rounded border transition-colors tracking-widest font-mono ${
                              isMaxActive
                                ? "bg-amber-950/40 border-amber-900 text-amber-500"
                                : "bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700"
                            }`}
                            title="Toggle Max Speed (252 EVs + Positive Nature)"
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

            {/* Timeline Legend Footer */}
            <div className="flex justify-between items-center mt-4 px-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest font-mono">Your Team</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-zinc-500/60" />
                  <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest font-mono">Opponent</span>
                </div>
              </div>
              <span className="text-[7px] font-bold text-zinc-700 uppercase tracking-widest font-mono">
                {isTrickRoom ? "Slowest moves first" : "Fastest moves first"} 
                {" | "} 
                {activeSlots.length} Active
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

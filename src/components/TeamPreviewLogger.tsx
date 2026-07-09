"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { metaPokemon, Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { parsePokePaste, ParsedPokemon } from "../lib/parser";
import metaTeamsData from "../data/meta_teams.json";
import LivePlaybook from "./LivePlaybook";
import SpeedBoard from "./SpeedBoard";
import DamageCalculator from "./DamageCalculator";

const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

interface TeamPreviewLoggerProps {
  playerTeam?: ParsedPokemon[];
  onGoToForge?: () => void;
}

export default function TeamPreviewLogger({ playerTeam = [], onGoToForge }: TeamPreviewLoggerProps) {
  const [selected, setSelected] = useState<Pokemon[]>([]);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [playbookData, setPlaybookData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [format, setFormat] = useState("reg_mb");
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [liveMetaTeams, setLiveMetaTeams] = useState<{ name: string; paste: string; description?: string }[]>(metaTeamsData);

  // New Turn 1 State Machine
  const [matchPhase, setMatchPhase] = useState<"pregame" | "turn1">("pregame");
  const [playerLockedIndices, setPlayerLockedIndices] = useState<number[]>([]);
  const [opponentLeadIndices, setOpponentLeadIndices] = useState<number[]>([]);
  
  // AI Draft Assistant
  const [isDrafting, setIsDrafting] = useState(false);
  const [coachNotes, setCoachNotes] = useState("");
  const [draftLeadsIndices, setDraftLeadsIndices] = useState<number[]>([]);

  // Auto-focus on mount
  useEffect(() => {
    if (playerTeam.length > 0) {
      inputRef.current?.focus();
    }
  }, [playerTeam.length]);

  const filtered = useMemo(() => {
    if (query.trim() === "") return [];
    const searchVal = normalize(query);
    return metaPokemon.filter(p => normalize(p.name).includes(searchVal)).slice(0, 50);
  }, [query]);

  const handleSelect = (pokemon: Pokemon) => {
    if (selected.length < 6) {
      setSelected([...selected, pokemon]);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[0]);
    }
  };

  const handleRemove = (index: number) => {
    setSelected(selected.filter((_, i) => i !== index));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const payload = matchPhase === "turn1" 
        ? {
            action: "turn1",
            playerLockedRoster: playerLockedIndices.map(i => playerTeam[i]),
            opponentKnownLeads: opponentLeadIndices.map(i => selected[i]),
            opponentPotentialBackline: selected.filter((_, i) => !opponentLeadIndices.includes(i))
          }
        : {
            action: "audit",
            team: playerTeam, 
            opponent: selected 
          };

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setPlaybookData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextTurn = async (matchContext: string) => {
    try {
      const payload = {
        action: "turn1",
        playerLockedRoster: playerLockedIndices.map(i => playerTeam[i]),
        opponentKnownLeads: opponentLeadIndices.map(i => selected[i]),
        opponentPotentialBackline: selected.filter((_, i) => !opponentLeadIndices.includes(i)),
        currentMatchContext: matchContext
      };

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setPlaybookData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSuggestDraft = async () => {
    setIsDrafting(true);
    setCoachNotes("");
    try {
      const payload = {
        action: "draft_suggestion",
        team: playerTeam,
        opponent: selected
      };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.suggestedDraft) {
        const newIndices: number[] = [];
        data.suggestedDraft.forEach((name: string) => {
          const idx = playerTeam.findIndex(p => normalize(p.name) === normalize(name));
          if (idx !== -1 && newIndices.length < 4 && !newIndices.includes(idx)) {
            newIndices.push(idx);
          }
        });
        setPlayerLockedIndices(newIndices);
      }
      if (data.suggestedLeads) {
        const leadIndices: number[] = [];
        data.suggestedLeads.forEach((name: string) => {
          const idx = playerTeam.findIndex(p => normalize(p.name) === normalize(name));
          if (idx !== -1 && leadIndices.length < 2 && !leadIndices.includes(idx)) {
            leadIndices.push(idx);
          }
        });
        setDraftLeadsIndices(leadIndices);
      }
      if (data.rationale) {
        setCoachNotes(data.rationale);
      }
    } catch (e) {
      console.error(e);
      setCoachNotes("Failed to fetch draft suggestion.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleLoadMetaTeam = (pasteText: string) => {
    const parsed = parsePokePaste(pasteText);
    const resolvedOpponents = parsed
      .map(p => metaPokemon.find(mp => normalize(mp.name) === normalize(p.name)))
      .filter(Boolean) as Pokemon[];
    setSelected(resolvedOpponents.slice(0, 6));
    setShowMetaModal(false);
  };

  const handleFetchLadderTeams = async () => {
    setIsFetchingMeta(true);
    try {
      const res = await fetch("/api/ladder-teams");
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      if (Array.isArray(data?.teams) && data.teams.length > 0) {
        setLiveMetaTeams(data.teams);
      }
    } catch (e) {
      console.error("Limitless scrape failed, keeping static fallback:", e);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  if (playbookData) {
    return (
      <div className="w-full flex flex-col items-center">
        {matchPhase === "turn1" && (
          <div className="w-full max-w-2xl px-6 pt-4 flex flex-col gap-2">
            <SpeedBoard 
              playerMons={
                draftLeadsIndices.length === 2 
                  ? draftLeadsIndices.map(i => playerTeam[i])
                  : playerLockedIndices.slice(0, 2).map(i => playerTeam[i])
              } 
              opponentMons={opponentLeadIndices.map(i => selected[i])} 
            />
            <DamageCalculator 
              playerMons={
                draftLeadsIndices.length === 2 
                  ? draftLeadsIndices.map(i => playerTeam[i])
                  : playerLockedIndices.slice(0, 2).map(i => playerTeam[i])
              } 
              opponentMons={opponentLeadIndices.map(i => selected[i])} 
            />
          </div>
        )}
        <LivePlaybook 
          team={selected} 
          data={playbookData} 
          onBack={() => setPlaybookData(null)} 
          onNextTurn={matchPhase === "turn1" ? handleNextTurn : undefined}
        />
      </div>
    );
  }

  if (playerTeam.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 text-center space-y-6">
        <h2 className="text-4xl font-black tracking-tight text-white/50">Roster empty.</h2>
        <p className="text-zinc-500 font-medium">Please import or build a team in the Team Forge to begin logging matchups.</p>
        <button 
          onClick={onGoToForge} 
          className="mt-4 px-8 py-4 bg-zinc-900 hover:bg-blue-600 border border-zinc-800 hover:border-blue-500 text-white rounded-xl font-bold transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center gap-3 uppercase tracking-wider text-sm"
        >
          <span>Go to Team Forge</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-8">
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      
      {/* Left Column: Player Team */}
      <div className="space-y-6 flex flex-col lg:border-r lg:border-zinc-800 lg:pr-16">
        <div className="text-center lg:text-left space-y-2">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <h2 className="text-3xl font-black tracking-tight text-white">Your Team</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Format</label>
              <select 
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="reg_mb">Pokémon Champions (Reg M-B)</option>
              </select>
            </div>
          </div>
          <p className="text-emerald-500 text-sm font-bold tracking-widest uppercase">
            {matchPhase === "turn1" ? `Select Brought ( ${playerLockedIndices.length}/4 )` : "Optimized 66-SP Roster"}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 opacity-90">
          {playerTeam.map((p, i) => {
            const isSelected = playerLockedIndices.includes(i);
            const isSelectable = matchPhase === "turn1";
            const isDraftLead = draftLeadsIndices.includes(i);
            return (
              <div 
                key={i} 
                onClick={() => {
                  if (!isSelectable) return;
                  if (isSelected) {
                    setPlayerLockedIndices(prev => prev.filter(idx => idx !== i));
                  } else if (playerLockedIndices.length < 4) {
                    setPlayerLockedIndices(prev => [...prev, i]);
                  }
                }}
                className={`aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-all duration-300 ${
                  isSelectable 
                    ? isSelected 
                      ? "bg-emerald-900/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer scale-105 z-10" 
                      : "bg-zinc-900/50 border-zinc-800 cursor-pointer hover:border-emerald-500/50 opacity-50 hover:opacity-100"
                    : "bg-zinc-900 border-zinc-800 pointer-events-none opacity-90 shadow-inner"
                }`}
              >
                <img 
                  src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                  alt={p.name} 
                  className="w-20 h-20 object-contain drop-shadow-md" 
                  onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                />
                <span className={`absolute bottom-2 text-[10px] font-bold px-1 text-center leading-tight uppercase tracking-widest ${isSelected ? 'text-emerald-300' : 'text-zinc-400'}`}>
                  {p.name}
                </span>
                {isDraftLead && (
                  <div className="absolute top-2 left-2 bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.5)] font-black text-[10px]">
                    L
                  </div>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-sm">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* AI Draft Assistant */}
        {matchPhase === "turn1" && selected.length === 6 && (
          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={handleSuggestDraft}
              disabled={isDrafting}
              className="w-full py-3 rounded-xl font-black text-xs sm:text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-blue-600/20 border-blue-500/50 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
            >
              {isDrafting ? "Analyzing Matchup..." : "💡 Ask AI Coach: Suggest Draft"}
            </button>
            
            {coachNotes && (
              <div 
                className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4 cursor-pointer hover:border-blue-700/50 transition-colors relative group animate-in fade-in slide-in-from-top-2 duration-300"
                onClick={() => setCoachNotes("")}
              >
                <div className="absolute top-2 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-400 text-xs font-bold">✕ Dismiss</div>
                <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Coach's Notes
                </h4>
                <p className="text-sm text-blue-100 leading-relaxed font-medium">{coachNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Opponent Logger */}
      <div className="space-y-6 flex flex-col">
        <div className="text-center lg:text-left space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white">
            {matchPhase === "turn1" ? "Turn 1 Lock-In" : "Team Preview"}
          </h2>
          <p className="text-red-500 text-sm font-bold tracking-widest uppercase">
            {matchPhase === "turn1" 
              ? `Select Opponent Leads ( ${opponentLeadIndices.length}/2 )`
              : `Log Opposing Team (${selected.length}/6)`
            }
          </p>
        </div>

        {/* Grid */}
        {selected.length === 6 && matchPhase === "turn1" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Opponent Leads</p>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {selected.map((p, i) => {
                const isLead = opponentLeadIndices.includes(i);
                return (
                  <div 
                    key={i}
                    onClick={() => {
                      if (isLead) {
                        setOpponentLeadIndices(prev => prev.filter(idx => idx !== i));
                      } else if (opponentLeadIndices.length < 2) {
                        setOpponentLeadIndices(prev => [...prev, i]);
                      }
                    }}
                    className={`aspect-square rounded-2xl border flex flex-col items-center justify-center relative cursor-pointer transition-all duration-300 ${
                      isLead
                        ? "bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-105 z-10"
                        : "bg-zinc-900/50 border-zinc-800 opacity-50 hover:opacity-100 hover:border-red-500/50"
                    }`}
                  >
                    <img src={p.spriteUrl} alt={p.name} className="w-16 h-16 object-contain drop-shadow-lg" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                    <span className={`absolute bottom-2 text-[10px] font-bold px-1 text-center leading-tight uppercase tracking-widest ${isLead ? "text-red-200" : "text-zinc-500"}`}>{p.name}</span>
                    {isLead && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 shadow-sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mt-6">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">Potential Backline (Fog of War)</p>
              <div className="flex gap-3 flex-wrap">
                {selected.map((p, i) => {
                  if (opponentLeadIndices.includes(i)) return null;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg opacity-60">
                      <img src={p.spriteUrl} alt={p.name} className="w-6 h-6 object-contain" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : selected.length === 6 && matchPhase === "pregame" ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Opponent Roster (6)</p>
              <button 
                onClick={() => setSelected([])} 
                className="text-[9px] text-zinc-600 font-medium bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              {selected.map((p, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleRemove(i)}
                    className="aspect-square rounded-2xl border bg-zinc-900 border-zinc-800 cursor-pointer hover:border-red-500 hover:bg-zinc-800 shadow-inner flex flex-col items-center justify-center relative group transition-all"
                  >
                    <img src={p.spriteUrl} alt={p.name} className="w-16 h-16 object-contain drop-shadow-lg" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                    <span className="absolute bottom-2 text-[10px] font-bold text-zinc-400 px-1 text-center leading-tight uppercase tracking-widest group-hover:text-red-200">{p.name}</span>
                    <div className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => {
              const p = selected[i];
              return (
                <div 
                  key={i} 
                  onClick={() => p && handleRemove(i)}
                  className={`aspect-square rounded-2xl border flex flex-col items-center justify-center relative transition-all ${
                    p 
                      ? "bg-zinc-800/80 border-zinc-700 cursor-pointer hover:border-red-500/50 shadow-inner" 
                      : "bg-zinc-900/50 border-zinc-800 border-dashed"
                  }`}
                >
                  {p ? (
                    <>
                      <img 
                        src={p.spriteUrl} 
                        alt={p.name} 
                        className="w-20 h-20 object-contain drop-shadow-lg" 
                        onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                      />
                      <span className="absolute bottom-2 text-[10px] font-bold text-zinc-200 px-1 text-center leading-tight uppercase tracking-widest">
                        {p.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-700 text-xl font-black">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Input */}
        {matchPhase === "pregame" && (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={selected.length === 6 || isLoading}
              placeholder={selected.length === 6 ? "Team complete" : "Search Pokémon..."}
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-lg text-white font-medium focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 disabled:opacity-50 transition-all placeholder:text-zinc-600 shadow-inner"
            />
            
            {/* Suggestions Dropdown */}
            {filtered.length > 0 && selected.length < 6 && !isLoading && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border-2 border-zinc-700 rounded-2xl overflow-hidden shadow-2xl z-10 max-h-60 overflow-y-auto">
                {filtered.map((p, i) => (
                  <div 
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-zinc-700 transition-colors ${i === 0 ? 'bg-zinc-700/50' : ''}`}
                  >
                    <img 
                      src={p.spriteUrl} 
                      alt={p.name} 
                      className="w-12 h-12 object-contain drop-shadow-md" 
                      onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                    />
                    <span className="font-bold text-zinc-100">{p.name}</span>
                    {i === 0 && <span className="ml-auto text-xs font-semibold text-zinc-400 uppercase tracking-wider">Press Enter ↵</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {matchPhase === "pregame" ? (
            <>
              <button
                onClick={() => { setShowMetaModal(true); handleFetchLadderTeams(); }}
                disabled={isFetchingMeta || selected.length === 6}
                className="py-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-300 bg-amber-600/20 border border-amber-500/50 text-amber-400 hover:bg-amber-600/30 hover:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed uppercase tracking-wide flex items-center justify-center gap-2"
              >
                {isFetchingMeta ? "Scraping..." : "Load Ladder Team"}
              </button>
              <button
                onClick={() => setMatchPhase("turn1")}
                disabled={selected.length < 6}
                className="py-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 hover:border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
              >
                Start Match (Select Leads)
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMatchPhase("pregame")}
                className="py-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-300 bg-zinc-800 border-2 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white uppercase tracking-wide flex items-center justify-center gap-2"
              >
                ← Back to Pre-Game
              </button>
              <button
                onClick={handleGenerate}
                disabled={playerLockedIndices.length !== 4 || opponentLeadIndices.length !== 2 || isLoading}
                className="py-4 rounded-2xl font-black text-xs sm:text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-600 border-red-500 text-white hover:bg-red-500 hover:border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
              >
                {isLoading ? "Locking..." : "Lock Leads"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Load Meta Core Modal */}
      {showMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-500">Regulation M-B Ladder Teams</h3>
              <button 
                onClick={() => setShowMetaModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-2">
              {isFetchingMeta ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-zinc-800 rounded w-2/5 mb-2"></div>
                    <div className="h-3 bg-zinc-800 rounded w-4/5"></div>
                  </div>
                ))
              ) : (
                liveMetaTeams.map((team, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleLoadMetaTeam(team.paste)}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:border-amber-500/50 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-white group-hover:text-amber-400 transition-colors">{team.name}</h4>
                    </div>
                    {team.description && <p className="text-xs text-zinc-400">{team.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    
    {matchPhase === "pregame" && (
      <div className="w-full flex justify-center py-6 border-t border-zinc-800/40 mt-4">
        <button
          onClick={handleGenerate}
          disabled={playerTeam.length < 6 || selected.length < 6 || isLoading}
          className="w-full max-w-xl py-5 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900/50 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-600 border-red-500 hover:bg-red-500 hover:border-red-400 text-white shadow-[0_0_30px_rgba(220,38,38,0.2)] disabled:shadow-none uppercase tracking-widest flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Forging Playbook...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Assess Matchup & Draft Leads</span>
            </>
          )}
        </button>
      </div>
    )}
  </div>
  );
}

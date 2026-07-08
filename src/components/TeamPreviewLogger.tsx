"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { metaPokemon, Pokemon, POKEBALL_FALLBACK } from "../lib/pokemon";
import { parsePokePaste, ParsedPokemon } from "../lib/parser";
import metaTeamsData from "../data/meta_teams.json";
import LivePlaybook from "./LivePlaybook";

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
  const [swapTargetIndex, setSwapTargetIndex] = useState<number | null>(null);
  // Initialise with static JSON as the safe fallback — replaced by AI fetch on demand
  const [liveMetaTeams, setLiveMetaTeams] = useState<{ name: string; paste: string; description?: string }[]>(metaTeamsData);

  // Auto-focus on mount
  useEffect(() => {
    if (playerTeam.length > 0) {
      inputRef.current?.focus();
    }
  }, [playerTeam.length]);

  // Uncapped search — filters the full 1200+ database, capped only at 50 rendered results for dropdown perf
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
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          team: playerTeam, 
          opponent: selected.length === 6 ? selected.slice(0, 4) : selected 
        })
      });
      const data = await res.json();
      setPlaybookData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
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
      // GET /api/limitless — scrapes play.limitlesstcg.com for real tournament teams
      const res = await fetch("/api/limitless");
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      // Defensive: only update if the scraper returned a valid teams array
      if (Array.isArray(data?.teams) && data.teams.length > 0) {
        setLiveMetaTeams(data.teams);
      }
    } catch (e) {
      console.error("Limitless scrape failed, keeping static fallback:", e);
      // liveMetaTeams remains as the static metaTeamsData initialised above
    } finally {
      setIsFetchingMeta(false);
    }
  };

  if (playbookData) {
    return (
      <div className="w-full flex flex-col items-center">
        {selected.length === 6 && (
          <div className="w-full max-w-2xl bg-zinc-900 border-x border-t border-zinc-800 rounded-t-3xl p-6 flex flex-col sm:flex-row justify-between items-center gap-6 relative z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
            <div className="flex gap-4">
              {selected.slice(0, 4).map((p, i) => (
                <div 
                  key={i} 
                  onClick={() => setSwapTargetIndex(i)}
                  className="w-16 h-16 bg-zinc-800 rounded-xl border-2 border-zinc-700 flex items-center justify-center cursor-pointer hover:border-red-500 relative group transition-colors shadow-sm"
                  title={`Swap ${p.name}`}
                >
                  <img src={p.spriteUrl} alt={p.name} className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                  <div className="absolute inset-0 bg-black/60 rounded-lg hidden group-hover:flex items-center justify-center">
                     <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handleGenerate}
              disabled={isLoading}
              className="text-xs font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white px-6 py-4 rounded-xl transition-all shadow-lg hover:shadow-red-500/30 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? "Wait..." : "Recalculate"}
            </button>
          </div>
        )}
        <LivePlaybook team={selected} data={playbookData} onBack={() => setPlaybookData(null)} />

        {swapTargetIndex !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
              <h3 className="text-xl font-black text-white mb-6">Swap Active Slot {swapTargetIndex + 1}</h3>
              <div className="grid grid-cols-2 gap-4 w-full">
                {[4, 5].map((benchIndex) => {
                  const benchedP = selected[benchIndex];
                  if (!benchedP) return null;
                  return (
                    <div
                      key={benchIndex}
                      onClick={() => {
                        const newSelected = [...selected];
                        const temp = newSelected[swapTargetIndex];
                        newSelected[swapTargetIndex] = newSelected[benchIndex];
                        newSelected[benchIndex] = temp;
                        setSelected(newSelected);
                        setSwapTargetIndex(null);
                      }}
                      className="aspect-square bg-zinc-800 border border-zinc-700 rounded-2xl cursor-pointer hover:border-red-500 hover:bg-zinc-700 transition-colors flex flex-col items-center justify-center relative"
                    >
                      <img src={benchedP.spriteUrl} alt={benchedP.name} className="w-16 h-16 object-contain mb-2" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                      <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{benchedP.name}</span>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => setSwapTargetIndex(null)} className="mt-8 text-zinc-500 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors">Cancel</button>
            </div>
          </div>
        )}
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
    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      
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
          <p className="text-emerald-500 text-sm font-bold tracking-widest uppercase">Optimized 66-SP Roster</p>
        </div>
        
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 opacity-90">
          {playerTeam.map((p, i) => (
            <div key={i} className="aspect-square rounded-2xl border bg-zinc-900 border-zinc-800 shadow-inner flex flex-col items-center justify-center relative pointer-events-none">
              <img 
                src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                alt={p.name} 
                className="w-20 h-20 object-contain drop-shadow-md" 
                onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
              />
              <span className="absolute bottom-2 text-[10px] font-bold text-zinc-400 px-1 text-center leading-tight uppercase tracking-widest">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Opponent Logger */}
      <div className="space-y-6 flex flex-col">
        <div className="text-center lg:text-left space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white">Team Preview</h2>
          <p className="text-red-500 text-sm font-bold tracking-widest uppercase">Log Opposing Team (6/6)</p>
        </div>

        {/* Grid */}
        {selected.length === 6 ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Roster (4)</p>
              <span className="text-[9px] text-zinc-600 font-medium bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">Click to swap</span>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => {
                const p = selected[i];
                return (
                  <div 
                    key={i} 
                    onClick={() => setSwapTargetIndex(i)}
                    className="aspect-square rounded-2xl border bg-red-950/20 border-red-900/50 cursor-pointer hover:border-red-500 hover:bg-red-900/30 shadow-inner flex flex-col items-center justify-center relative group transition-all"
                  >
                    <img src={p.spriteUrl} alt={p.name} className="w-16 h-16 object-contain drop-shadow-lg" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                    <span className="absolute bottom-2 text-[10px] font-bold text-red-200 px-1 text-center leading-tight uppercase tracking-widest">{p.name}</span>
                    <div className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Benched (2)</p>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 2 }).map((_, i) => {
                const actualIndex = i + 4;
                const p = selected[actualIndex];
                return (
                  <div 
                    key={actualIndex} 
                    onClick={() => handleRemove(actualIndex)}
                    className="aspect-square rounded-2xl border bg-zinc-900/80 border-zinc-800 cursor-pointer hover:border-zinc-600 shadow-inner opacity-75 hover:opacity-100 flex flex-col items-center justify-center relative transition-all"
                    title="Click to remove"
                  >
                    <img src={p.spriteUrl} alt={p.name} className="w-14 h-14 object-contain drop-shadow-lg" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                    <span className="absolute bottom-2 text-[9px] font-bold text-zinc-400 px-1 text-center leading-tight uppercase tracking-widest">{p.name}</span>
                  </div>
                );
              })}
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

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setShowMetaModal(true); handleFetchLadderTeams(); }}
            disabled={isFetchingMeta}
            className="py-4 rounded-2xl font-black text-sm transition-all duration-300 bg-amber-600/20 border border-amber-500/50 text-amber-400 hover:bg-amber-600/30 hover:border-amber-500 disabled:opacity-60 disabled:cursor-wait uppercase tracking-wide flex items-center justify-center gap-2"
          >
            {isFetchingMeta ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scraping Limitless VGC...
              </>
            ) : (
              "Load Ladder Team"
            )}
          </button>
          <button
            onClick={handleGenerate}
            disabled={selected.length < 6 || isLoading}
            className="py-4 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-600 border-red-500 text-white hover:bg-red-500 hover:border-red-400 shadow-[0_0_30px_rgba(220,38,38,0.3)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Forging...
              </>
            ) : (
              "Generate Playbook"
            )}
          </button>
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
                // Loading skeleton while the AI is scanning the meta
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

      {/* Main View Swap Modal */}
      {swapTargetIndex !== null && !playbookData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-white mb-6">Swap Active Slot {swapTargetIndex + 1}</h3>
            <div className="grid grid-cols-2 gap-4 w-full">
              {[4, 5].map((benchIndex) => {
                const benchedP = selected[benchIndex];
                if (!benchedP) return null;
                return (
                  <div
                    key={benchIndex}
                    onClick={() => {
                      const newSelected = [...selected];
                      const temp = newSelected[swapTargetIndex];
                      newSelected[swapTargetIndex] = newSelected[benchIndex];
                      newSelected[benchIndex] = temp;
                      setSelected(newSelected);
                      setSwapTargetIndex(null);
                    }}
                    className="aspect-square bg-zinc-800 border border-zinc-700 rounded-2xl cursor-pointer hover:border-red-500 hover:bg-zinc-700 transition-colors flex flex-col items-center justify-center relative"
                  >
                    <img src={benchedP.spriteUrl} alt={benchedP.name} className="w-16 h-16 object-contain mb-2" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{benchedP.name}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={() => setSwapTargetIndex(null)} className="mt-8 text-zinc-500 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

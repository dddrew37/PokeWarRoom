"use client";

import { useState } from "react";
import { parsePokePaste, ParsedPokemon } from "../lib/parser";
import RosterVisualizer from "./RosterVisualizer";
import SpeedVisualizer from "./SpeedVisualizer";
import ManualForge from "./ManualForge";
import { supabase } from "../lib/supabase";
import { POKEBALL_FALLBACK } from "../lib/pokemon";
import metaTeamsData from "../data/meta_teams.json";

export default function TeamForge({ team, setTeam }: { team: ParsedPokemon[], setTeam: React.Dispatch<React.SetStateAction<ParsedPokemon[]>> }) {
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<"paste" | "manual">("manual");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);

  // Supabase states
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [savedTeams, setSavedTeams] = useState<any[]>([]);

  const [showMetaModal, setShowMetaModal] = useState(false);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [liveMetaTeams, setLiveMetaTeams] = useState<{ name: string; paste: string; description?: string }[]>(metaTeamsData);

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
      console.error("Ladder teams scrape failed, keeping static fallback:", e);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  // Team name input — replaces the prompt() for saving rosters
  const [teamName, setTeamName] = useState("");
  const [format, setFormat] = useState("reg_mb");

  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  const handleImport = () => {
    if (!paste.trim()) return;
    const parsed = parsePokePaste(paste);
    setTeam(parsed);
    setActiveEditIndex(null);
  };

  const handleOptimize = async () => {
    if (team.length === 0) return;
    setIsOptimizing(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, action: "optimize" })
      });
      
      const data = await res.json();
      
      if (data.optimized_team) {
        setTeam(prev => prev.map(p => {
          // Attempt to match by id, or simply by name if id changed
          const optimized = data.optimized_team.find((op: any) => op.id === p.id || op.name === p.name);
          if (optimized && optimized.sp) {
             const newSp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...optimized.sp };
             let total = 0;
             const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
             
             // Strict Rule 1: Max 32 per stat, Min 0
             STATS.forEach(s => {
               newSp[s] = Math.max(0, Math.min(Number(newSp[s]) || 0, 32));
               total += newSp[s];
             });
             
             // Strict Rule 2: Max 66 total SP
             if (total > 66) {
               let diff = total - 66;
               while(diff > 0) {
                 const highestStat = STATS.reduce((max, s) => newSp[s] > newSp[max] ? s : max, "hp" as const);
                 newSp[highestStat] -= 1;
                 diff--;
               }
             }

             return { ...p, sp: newSp };
          }
          return p;
        }));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to optimize team. Ensure AI_API_KEY is configured.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAssessTeam = async () => {
    if (team.length !== 6) return;
    setIsAssessing(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, action: "assess" })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAssessmentResult(data);
    } catch (e) {
      console.error("[TeamForge] Assess Team error:", e);
      alert("Failed to assess team. Check console for details.");
    } finally {
      setIsAssessing(false);
    }
  };

  const handleSaveRoster = async () => {
    console.log("--- SAVE ROSTER TRIGGERED ---");
    console.log("[TeamForge] team.length =", team.length, "| teamName =", JSON.stringify(teamName), "| supabase configured =", !!supabase);

    if (team.length !== 6) {
      const msg = `Cannot save: roster has ${team.length}/6 Pokémon. You need exactly 6 to save.`;
      console.warn("[TeamForge] Guard:", msg);
      alert(msg);
      return;
    }
    if (!supabase) {
      console.warn("[TeamForge] Guard: Supabase client is null. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
      alert("Supabase not configured in .env! Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    if (!teamName.trim()) {
      console.warn("[TeamForge] Guard: teamName is empty. Save aborted.");
      alert("Cannot save: please enter a Team Name in the field above the Save Roster button.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("saved_teams").insert([{
        team_name: teamName,
        team_data: team
      }]);

      if (error) {
        console.error("[Supabase] saved_teams INSERT error:", error?.message || "Unknown Network Error", error);
        alert("Failed to save roster: " + error.message);
      } else {
        alert("Roster saved successfully!");
        // Immediately refresh the saved teams list so the Load modal is up to date
        await refreshSavedTeams();
      }
    } catch (err: unknown) {
      console.error("[Supabase] saved_teams INSERT exception:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to save roster: " + message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Shared fetch helper — keeps savedTeams state in sync after both saves and explicit loads. */
  const refreshSavedTeams = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("saved_teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Supabase] saved_teams SELECT error:", error);
        alert("Failed to fetch saved rosters: " + error.message);
      } else if (data) {
        setSavedTeams(data);
      }
    } catch (err: unknown) {
      console.error("[Supabase] saved_teams SELECT exception:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to fetch saved rosters: " + message);
    }
  };

  const handleDeleteRoster = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent loading the team when clicking delete
    if (!supabase) return;
    if (!confirm("Are you sure you want to delete this roster?")) return;
    
    try {
      const { error } = await supabase.from('saved_teams').delete().eq('id', id);
      if (error) {
        console.error("[Supabase] saved_teams DELETE error:", error?.message || "Unknown error", error);
        alert("Failed to delete roster: " + error.message);
      } else {
        await refreshSavedTeams();
      }
    } catch (err: unknown) {
      console.error("[Supabase] saved_teams DELETE exception:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to delete roster: " + message);
    }
  };

  const handleFetchTeams = async () => {
    if (!supabase) {
      alert("Supabase not configured in .env! Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setIsLoadingTeams(true);
    setShowLoadModal(true);

    try {
      await refreshSavedTeams();
    } finally {
      setIsLoadingTeams(false);
    }
  };

  /**
   * Defensive normalizer: ensures every Pokémon loaded from Supabase has
   * the full expected shape. Fills missing `sp` / `evs` / `moves` fields so
   * legacy rows never crash the UI.
   */
  const normalizeSavedPokemon = (raw: any): ParsedPokemon => {
    const zeroStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    return {
      id: raw.id ?? '',
      name: raw.name ?? '',
      item: raw.item ?? '',
      ability: raw.ability ?? '',
      nature: raw.nature ?? '',
      evs: raw.evs ? { ...zeroStats, ...raw.evs } : { ...zeroStats },
      sp:  raw.sp  ? { ...zeroStats, ...raw.sp  } : { ...zeroStats },
      moves: Array.isArray(raw.moves) ? raw.moves : [],
    };
  };

  const handleLoadTeam = (loadedTeam: any[]) => {
    const normalized = loadedTeam.map(normalizeSavedPokemon);
    setTeam(normalized);
    setShowLoadModal(false);
    setActiveEditIndex(null);
  };

  const handleLoadMetaTeam = (pasteText: string) => {
    const parsed = parsePokePaste(pasteText);
    setTeam(parsed);
    setShowMetaModal(false);
    setActiveEditIndex(null);
  };

  const handleUpdateManualPokemon = (pokemon: ParsedPokemon, index: number) => {
    setTeam(prev => prev.map((mon, i) => i === index ? pokemon : mon));
    setActiveEditIndex(null);
    setMode("paste"); 
  };

  const handleAddManualPokemon = (pokemon: ParsedPokemon) => {
    setTeam(prev => {
      if (prev.length >= 6) return prev;
      return [...prev, pokemon];
    });
  };

  const handleEdit = (index: number) => {
    setActiveEditIndex(index);
    setMode("manual");
  };

  const handleCancelEdit = () => {
    setActiveEditIndex(null);
  };

  return (
    <div className="w-full flex flex-col items-center pb-20 relative">
      <div className="w-full max-w-2xl space-y-8 flex flex-col items-center">
        <div className="w-full text-center space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-3xl font-black tracking-tight text-white">Team Forge</h2>
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
          <p className="text-zinc-400 text-sm font-medium">Build or Import your 66-SP Roster</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-zinc-900 p-1.5 rounded-2xl border-2 border-zinc-800 shadow-inner w-full max-w-md">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === "manual"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Manual Builder
          </button>
          <button
            onClick={() => { setMode("paste"); setActiveEditIndex(null); }}
            className={`flex-1 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === "paste"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Paste Importer
          </button>
        </div>

        {mode === "paste" ? (
          <div className="w-full space-y-6">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste your Pokémon Showdown export here..."
              className="w-full h-48 bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-5 text-sm font-mono text-zinc-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all resize-none shadow-inner leading-relaxed"
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={handleImport}
                disabled={!paste.trim()}
                className="col-span-2 py-3 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-blue-600 border-blue-500 text-white hover:bg-blue-500 hover:border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.2)] disabled:shadow-none uppercase tracking-wide"
              >
                Import
              </button>
              <button
                onClick={handleOptimize}
                disabled={team.length === 0 || isOptimizing}
                className="col-span-2 py-3 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 hover:border-emerald-400 shadow-[0_0_20px_rgba(5,150,105,0.2)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
              >
                {isOptimizing ? "Optimizing..." : "Auto-Optimize"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
              {/* Team name input — required to save a roster */}
              <div className="col-span-2">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter Team Name..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                />
              </div>
              <button
                onClick={handleAssessTeam}
                disabled={team.length !== 6 || isAssessing}
                className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-600/30 hover:border-indigo-500 uppercase tracking-widest"
              >
                {isAssessing ? "Assessing..." : "Assess Team"}
              </button>
              <button
                onClick={handleSaveRoster}
                disabled={team.length !== 6 || isSaving}
                className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600/20 border border-purple-500/50 text-purple-400 hover:bg-purple-600/30 hover:border-purple-500 uppercase tracking-widest"
              >
                {isSaving ? "Saving..." : "Save Roster"}
              </button>
              <button
                onClick={handleFetchTeams}
                className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white uppercase tracking-widest"
              >
                Load Roster
              </button>
              <button
                onClick={() => { setShowMetaModal(true); handleFetchLadderTeams(); }}
                disabled={isFetchingMeta}
                className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 bg-amber-600/20 border border-amber-500/50 text-amber-400 hover:bg-amber-600/30 hover:border-amber-500 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {isFetchingMeta ? "Scraping..." : "Load Ladder Team"}
              </button>
            </div>
            
            {team.length > 0 && (
               <p className="text-zinc-500 text-[10px] text-center font-bold tracking-widest uppercase">
                 Team imported. Auto-Optimize calculates 66-SP spreads.
               </p>
            )}
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <ManualForge 
              onAddPokemon={handleAddManualPokemon} 
              onUpdatePokemon={handleUpdateManualPokemon}
              canAdd={team.length < 6 || activeEditIndex !== null} 
              team={team} 
              activeEditIndex={activeEditIndex} 
              onCancelEdit={handleCancelEdit} 
            />
          </div>
        )}
      </div>

      <div className="mt-12 w-full">
        <RosterVisualizer team={team} onEdit={handleEdit} />
      </div>

      {team.length > 0 && (
        <div className="mt-8 w-full max-w-4xl mx-auto">
          <SpeedVisualizer team={team} />
        </div>
      )}

      {/* Load Roster Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Load Roster</h3>
              <button 
                onClick={() => setShowLoadModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {isLoadingTeams ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-500 border-t-transparent"></div>
              </div>
            ) : savedTeams.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 font-bold uppercase tracking-widest text-sm">
                No saved rosters found.
              </div>
            ) : (
              <div className="overflow-y-auto space-y-3 pr-2">
                {savedTeams.map((strat) => (
                  <div 
                    key={strat.id}
                    onClick={() => handleLoadTeam(strat.team_data)}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:border-blue-500 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-black text-white group-hover:text-blue-400 transition-colors">{strat.team_name}</h4>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                          {new Date(strat.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteRoster(strat.id, e)}
                        className="text-zinc-500 hover:text-red-500 p-2 -mr-2 -mt-2 transition-colors rounded-lg hover:bg-red-500/10"
                        title="Delete Roster"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {strat.team_data.map((p: any, i: number) => (
                        <img 
                          key={i} 
                          src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                          alt={p.name} 
                          className="w-10 h-10 object-contain rounded-full bg-zinc-900 border border-zinc-800 drop-shadow-md" 
                          onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Load Meta Core Modal */}
      {showMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-amber-500">Ladder Teams (6-Man)</h3>
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

      {/* Assessment Modal */}
      {assessmentResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Sticky Header */}
            <div className="sticky top-0 z-50 bg-zinc-900 p-6 border-b border-zinc-800 shadow-sm flex flex-col gap-4">
              <button 
                onClick={() => setAssessmentResult(null)}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold w-fit"
              >
                ← Close Assessment & Return to Roster
              </button>
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-indigo-400">Team Assessment</h3>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-zinc-300">
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Verdict</h4>
                <p className="text-sm font-medium">{assessmentResult.overall_verdict}</p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Vulnerabilities</h4>
                <ul className="space-y-2">
                  {assessmentResult.weaknesses?.map((w: string, i: number) => (
                    <li key={i} className="text-sm bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex gap-3">
                      <span className="text-red-500 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Suggested Leads</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assessmentResult.suggested_leads?.map((lead: any, i: number) => (
                    <div key={i} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                      <p className="font-black text-emerald-400 mb-1">{lead.pair}</p>
                      <p className="text-sm text-zinc-400 leading-relaxed">{lead.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

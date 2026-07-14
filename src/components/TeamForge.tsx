"use client";

import { useState } from "react";
import { parsePokePaste, ParsedPokemon } from "../lib/parser";
import RosterVisualizer from "./RosterVisualizer";
import SpeedVisualizer from "./SpeedVisualizer";
import ManualForge from "./ManualForge";
import { supabase } from "../lib/supabase";
import { POKEBALL_FALLBACK } from "../lib/pokemon";
import metaTeamsData from "../data/meta_teams.json";
import { exportTeamToPokepaste } from "../utils/exporter";

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
  const [isExported, setIsExported] = useState(false);

  // Deep-Dive Dossier States
  const [isAssessingDeep, setIsAssessingDeep] = useState(false);
  const [dossierData, setDossierData] = useState<any>(null);
  const [showDossierModal, setShowDossierModal] = useState(false);

  // Dossier Sparring Chat States
  const [dossierChat, setDossierChat] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleAssessTeamDeepDive = async (chatContextPayload?: any[] | React.MouseEvent) => {
    if (team.length !== 6) return;
    setIsAssessingDeep(true);
    setShowDossierModal(true);
    setDossierData(null);
    try {
      const chatContext = Array.isArray(chatContextPayload) ? chatContextPayload : undefined;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          team, 
          action: "assess_team", 
          chatContext 
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDossierData(data);
      if (chatContext) {
        setDossierChat([]); // Wiping chat clean upon successful regeneration
      }
    } catch (e) {
      console.error("[TeamForge] Deep Dive Assess error:", e);
      alert("Failed to analyze team. Check API config.");
      setShowDossierModal(false);
    } finally {
      setIsAssessingDeep(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isChatting || !dossierData) return;
    const userMessage = { role: "user", content: chatInput };
    const updatedChat = [...dossierChat, userMessage];
    setDossierChat(updatedChat);
    setChatInput("");
    setIsChatting(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team,
          action: "dossier_chat",
          dossier: dossierData,
          messages: updatedChat
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.message) {
        setDossierChat(prev => [...prev, { role: "assistant", content: data.message }]);
      }
    } catch (e) {
      console.error("[TeamForge] Dossier chat error:", e);
      alert("Failed to send chat message.");
    } finally {
      setIsChatting(false);
    }
  };

  const handleExtractLesson = async () => {
    if (dossierChat.length === 0 || isExtracting) return;
    setIsExtracting(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_lesson",
          messages: dossierChat
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const ruleText: string = (data.message || "").trim();

      if (!ruleText || ruleText === "NO_RULE") {
        alert("No definitive rule detected in the chat.");
        return;
      }

      // Persist rule to memory bank
      const saveRes = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: ruleText })
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save to Memory Bank.");

      alert("Lesson saved to Memory Bank: " + ruleText);
    } catch (e) {
      console.error("[TeamForge] Extract lesson error:", e);
      alert("Failed to extract lesson. Check the console for details.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleClearChat = () => {
    setDossierChat([]);
  };

  const handleExport = async () => {
    if (team.length === 0) return;
    const formattedStr = exportTeamToPokepaste(team);
    try {
      await navigator.clipboard.writeText(formattedStr);
      setIsExported(true);
      setTimeout(() => setIsExported(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
      alert("Failed to export to clipboard. Your browser might block clipboard access.");
    }
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

             return { ...p, sp: newSp, spExplanations: optimized.explanations };
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

  const handleSaveRoster = async (dossierToSave?: any) => {
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
      const payload: any = {
        team_name: teamName,
        team_data: team
      };
      if (dossierToSave) {
        payload.assessment_data = dossierToSave;
      } else if (dossierData) {
        payload.assessment_data = dossierData;
      }

      const { error } = await supabase.from("saved_teams").insert([payload]);

      if (error) {
        console.error("[Supabase] saved_teams INSERT error:", error?.message || "Unknown Network Error", error);
        alert("Failed to save roster: " + error.message);
      } else {
        alert("Roster & Assessment saved successfully!");
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

  const handleLoadTeam = (loadedTeam: any[], assessmentData?: any) => {
    const normalized = loadedTeam.map(normalizeSavedPokemon);
    setTeam(normalized);
    setDossierData(assessmentData || null);
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
                className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-red-500"
              >
                <option value="reg_mb">Pokémon Champions (Reg M-B)</option>
              </select>
            </div>
          </div>
          <p className="text-zinc-400 text-sm font-medium">Build or Import your 66-SP Roster</p>
        </div>

        <div className="flex bg-black p-1.5 rounded-2xl border-2 border-zinc-800 shadow-inner w-full max-w-md">
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              mode === "manual"
                ? "bg-red-950/30 text-red-500 shadow-md border border-red-900/40"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            Manual Builder
          </button>
          <button
            onClick={() => { setMode("paste"); setActiveEditIndex(null); }}
            className={`flex-1 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              mode === "paste"
                ? "bg-red-950/30 text-red-500 shadow-md border border-red-900/40"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            Paste Importer
          </button>
        </div>

        {/* Load Actions (Persistent) */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-md mt-2">
          <button
            onClick={handleFetchTeams}
            className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white uppercase tracking-widest"
          >
            Load Roster
          </button>
          <button
            onClick={() => { setShowMetaModal(true); handleFetchLadderTeams(); }}
            disabled={isFetchingMeta}
            className="py-3 rounded-xl font-bold text-[10px] transition-all duration-300 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {isFetchingMeta ? "Scraping..." : "Load Ladder Team"}
          </button>
        </div>

        {mode === "paste" ? (
          <div className="w-full space-y-6">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="Paste your Pokémon Showdown export here..."
              className="w-full h-48 bg-zinc-900 border-2 border-zinc-800 rounded-2xl p-5 text-sm font-mono text-zinc-300 focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/20 transition-all resize-none shadow-inner leading-relaxed"
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={handleImport}
                disabled={!paste.trim()}
                className="col-span-2 py-3 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-700 border-red-500 text-white hover:bg-red-600 hover:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)] disabled:shadow-none uppercase tracking-wide"
              >
                Import
              </button>
              <button
                onClick={handleOptimize}
                disabled={team.length === 0 || isOptimizing}
                className="col-span-2 py-3 rounded-2xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-700 border-red-500 text-white hover:bg-red-600 hover:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)] disabled:shadow-none uppercase tracking-wide flex items-center justify-center gap-2"
              >
                {isOptimizing ? "Optimizing..." : "Auto-Optimize"}
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

      <div className="mt-12 w-full animate-fade-in">
        <RosterVisualizer team={team} onEdit={handleEdit} />
      </div>

      {team.length > 0 && (
        <div className="mt-8 w-full max-w-2xl mx-auto border-t border-zinc-800/50 pt-8 flex flex-col items-center gap-6">
          <div className="w-full flex flex-col items-center gap-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Team Identifier</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter Team Name..."
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-widest focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full max-w-xs text-center"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 w-full max-w-md">
            {/* Assess Team (Deep Dive) Button */}
            <button
              onClick={handleAssessTeamDeepDive}
              disabled={team.length !== 6 || isAssessingDeep}
              className="col-span-2 py-3.5 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isAssessingDeep ? "Analyzing Team..." : "Assess Team (Deep Dive)"}
            </button>

            {dossierData && (
              <button
                onClick={() => setShowDossierModal(true)}
                className="col-span-2 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 bg-red-950/30 border border-red-900/30 text-red-500 hover:bg-red-950/50 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                Re-Open Saved Assessment Dossier
              </button>
            )}

            <button
              onClick={handleAssessTeam}
              disabled={team.length !== 6 || isAssessing}
              className="py-3 rounded-xl font-black text-[10px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            >
              {isAssessing ? "Assessing..." : "Assess Team"}
            </button>
            <button
              onClick={() => handleSaveRoster()}
              disabled={team.length !== 6 || isSaving}
              className="py-3 rounded-xl font-black text-[10px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            >
              {isSaving ? "Saving..." : "Save Roster"}
            </button>
            <button
              onClick={handleExport}
              disabled={team.length === 0}
              className="col-span-2 py-3 rounded-xl font-bold text-[10px] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isExported ? "Copied!" : "Export to Clipboard"}
            </button>
          </div>
        </div>
      )}

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
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-red-500 border-t-transparent"></div>
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
                    onClick={() => handleLoadTeam(strat.team_data, strat.assessment_data)}
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:border-red-600/50 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-black text-white group-hover:text-red-500 transition-colors flex items-center gap-2">
                          {strat.team_name}
                          {strat.assessment_data && (
                            <span className="px-1.5 py-0.5 bg-red-950/40 text-red-500 border border-red-900/50 rounded text-[9px] font-black uppercase tracking-widest">
                              Dossier
                            </span>
                          )}
                        </h4>
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
              <h3 className="text-xl font-black text-red-500">Ladder Teams (6-Man)</h3>
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
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 cursor-pointer hover:border-red-600/50 transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-white group-hover:text-red-500 transition-colors">{team.name}</h4>
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
                Close Assessment & Return to Roster
              </button>
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-red-500">Team Assessment</h3>
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-zinc-300">
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Top Team Cores (Modes)</h4>
              <div className="grid grid-cols-1 gap-6">
                {assessmentResult.modes?.map((mode: any, i: number) => (
                  <div key={i} className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 flex flex-col gap-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <h5 className="text-xl font-black text-white">{mode.name}</h5>
                    </div>
                    
                    <div className="flex gap-3 flex-wrap">
                      {mode.pokemon?.map((name: string, pIdx: number) => {
                        const match = team.find(t => t.name.toLowerCase() === name.toLowerCase() || t.name.toLowerCase().includes(name.toLowerCase()));
                        return (
                          <div key={pIdx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center gap-2 shadow-inner">
                            {match ? (
                              <img 
                                src={`https://play.pokemonshowdown.com/sprites/gen5/${match.id}.png`}
                                className="w-8 h-8 object-contain drop-shadow-md"
                                onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                                alt={name}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">?</div>
                            )}
                            <span className="text-xs font-bold text-zinc-300 pr-2">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="bg-zinc-950 border border-red-900/30 rounded-xl p-4">
                      <h6 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1.5">When To Use</h6>
                      <p className="text-sm text-zinc-300 leading-relaxed font-medium">{mode.whenToUse}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep-Dive Assessment Dossier Modal */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Header */}
            <div className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-md px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-red-500 flex items-center gap-2 tracking-wider">
                <span>Roster Study Dossier</span>
              </h3>
              <button 
                onClick={() => setShowDossierModal(false)}
                className="text-zinc-500 hover:text-white transition-colors text-lg animate-fade-in"
              >
                ✕
              </button>
            </div>

            {/* Split Grid Layout Container */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800 min-h-0 overflow-hidden">
              
              {/* Left Side (col-span-2): Scrollable Dossier JSON UI */}
              <div className="lg:col-span-2 p-6 overflow-y-auto space-y-6 text-zinc-300 leading-relaxed max-h-[70vh]">
                {isAssessingDeep ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="animate-spin h-10 w-10 rounded-full border-4 border-red-500 border-t-transparent"></div>
                    <p className="text-base font-bold uppercase tracking-wider text-red-500 animate-pulse">Forging Roster Dossier...</p>
                    <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">Analyzing your 6-man roster with a heavy reasoning model to construct archetype paths, lead combos, and SP adjustments.</p>
                  </div>
                ) : !dossierData ? (
                  <div className="text-center py-12 text-zinc-500 font-bold uppercase tracking-widest text-sm">
                    No data loaded.
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    {/* Red Flags / Glaring Weaknesses */}
                    {dossierData.red_flags && dossierData.red_flags.length > 0 && (
                      <div className="bg-red-950/20 border-2 border-red-650 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_0_15px_rgba(220,38,38,0.15)] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-full bg-red-700/5 blur-3xl pointer-events-none" />
                        <div className="flex items-center gap-2 text-red-500 font-black uppercase tracking-widest text-xs font-mono">
                          <span>⚠️</span>
                          <span>Glaring Weakness Alert</span>
                        </div>
                        <ul className="space-y-2 font-mono text-[11px] font-semibold text-zinc-200">
                          {dossierData.red_flags.map((flag: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 leading-relaxed">
                              <span className="text-red-500 font-bold">•</span>
                              <span>{flag}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Core Identity */}
                    <div className="space-y-2">
                      <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Core Identity & Strategy</h4>
                      <p className="text-lg leading-relaxed text-zinc-200 font-medium">
                        {dossierData.core_identity}
                      </p>
                    </div>

                    {/* Suggested Lineups */}
                    <div className="space-y-6 pt-6 border-t border-zinc-800/60">
                      <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Suggested Lineups (4-Man Cores)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {dossierData.suggested_lineups?.map((lineup: any, i: number) => {
                          const getSpriteUrl = (monName: string) => {
                            const match = team.find(t => t.name.toLowerCase() === monName.toLowerCase() || t.name.toLowerCase().includes(monName.toLowerCase()));
                            if (match) return `https://play.pokemonshowdown.com/sprites/gen5/${match.id}.png`;
                            return `https://play.pokemonshowdown.com/sprites/gen5/${monName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
                          };

                          return (
                            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4 shadow-xl">
                              <div className="border-b border-zinc-850 pb-2.5 flex justify-between items-center">
                                <h5 className="text-sm font-black text-white tracking-wide uppercase">{lineup.lineup_name}</h5>
                                <span className="text-[8px] font-black text-red-500 bg-red-950/20 border border-red-900/35 rounded px-1.5 py-0.5 uppercase tracking-widest font-mono">
                                  LINEUP {i + 1}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {/* Front Line */}
                                <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-3 flex flex-col items-center gap-2">
                                  <span className="text-[8px] font-bold text-red-500 uppercase tracking-widest font-mono">Leads</span>
                                  <div className="flex justify-center gap-2.5">
                                    {lineup.front_line?.map((mon: string, mIdx: number) => (
                                      <div key={mIdx} className="flex flex-col items-center gap-0.5">
                                        <img 
                                          src={getSpriteUrl(mon)} 
                                          alt={mon} 
                                          className="w-10 h-10 object-contain drop-shadow-md"
                                          onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                                        />
                                        <span className="text-[9px] font-bold text-zinc-350 text-center leading-tight truncate w-16">{mon}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Back Line */}
                                <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-3 flex flex-col items-center gap-2">
                                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Bench</span>
                                  <div className="flex justify-center gap-2.5">
                                    {lineup.back_line?.map((mon: string, mIdx: number) => (
                                      <div key={mIdx} className="flex flex-col items-center gap-0.5">
                                        <img 
                                          src={getSpriteUrl(mon)} 
                                          alt={mon} 
                                          className="w-10 h-10 object-contain drop-shadow-md"
                                          onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                                        />
                                        <span className="text-[9px] font-bold text-zinc-400 text-center leading-tight truncate w-16">{mon}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="bg-zinc-900/10 rounded-xl p-3 border border-zinc-850/60">
                                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">Strategy Execution</p>
                                <p className="text-[11px] text-zinc-350 leading-relaxed font-medium">{lineup.strategy_explanation}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Threat Matrix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-800/60">
                      <div className="space-y-3 bg-zinc-950 border border-zinc-850 p-5 rounded-2xl">
                        <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3 flex items-center gap-1">
                          <span>Favorable Matchups</span>
                        </h4>
                        <ul className="space-y-2">
                          {dossierData.threat_matrix?.favorable_matchups?.map((matchup: string, i: number) => (
                            <li key={i} className="text-base text-zinc-300 flex items-start gap-2 leading-relaxed">
                              <span className="text-red-500/40 mt-0.5">•</span>
                              <span>{matchup}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-3 bg-zinc-950 border border-zinc-850 p-5 rounded-2xl">
                        <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3 flex items-center gap-1">
                          <span>Critical Vulnerabilities</span>
                        </h4>
                        <ul className="space-y-2">
                          {dossierData.threat_matrix?.critical_vulnerabilities?.map((vuln: string, i: number) => (
                            <li key={i} className="text-base text-zinc-300 flex items-start gap-2 leading-relaxed">
                              <span className="text-red-500/40 mt-0.5">•</span>
                              <span>{vuln}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Detailed Matchup Tactics */}
                    {dossierData.detailed_tactics && dossierData.detailed_tactics.length > 0 && (
                      <div className="space-y-4 pt-6 border-t border-zinc-800/60">
                        <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Detailed Matchup Tactics</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {dossierData.detailed_tactics.map((tactic: any, i: number) => (
                            <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
                              <h5 className="text-lg font-black text-white border-b border-zinc-850 pb-2 tracking-wide">{tactic.scenario_name}</h5>
                              <p className="text-sm text-zinc-400 italic leading-relaxed">{tactic.key_interactions}</p>
                              <div className="space-y-1.5 pt-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Execution Steps:</span>
                                <ul className="space-y-2 text-base text-zinc-350">
                                  {tactic.execution_steps?.map((step: string, sIdx: number) => (
                                    <li key={sIdx} className="leading-relaxed flex items-start gap-1.5">
                                      <span className="font-mono text-sm text-red-500 font-black whitespace-nowrap mt-0.5">TURN {sIdx + 1}:</span>
                                      <span>{step.replace(/^Turn \d+:\s*/i, "")}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Optimizations */}
                    <div className="space-y-4 pt-6 border-t border-zinc-800/60">
                      <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Roster Tweaks & Optimizations</h4>
                      <div className="space-y-3">
                        {dossierData.optimizations?.map((opt: any, i: number) => (
                          <div key={i} className="bg-zinc-950 border border-red-900/30 rounded-2xl p-4 space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-base font-black text-red-500 uppercase tracking-widest">{opt.target_pokemon}</span>
                            </div>
                            <p className="text-base text-zinc-200 font-extrabold">{opt.suggested_tweak}</p>
                            <p className="text-base text-zinc-400 leading-relaxed italic">{opt.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side (col-span-1): Sleek eSports Chat Interface */}
              <div className="lg:col-span-1 flex flex-col max-h-[70vh] overflow-hidden bg-zinc-950/30">
                
                {/* Reforge Action Header */}
                <div className="p-4 border-b border-zinc-800 flex flex-col gap-2 bg-zinc-900/40">
                  <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Sparring Engine</span>
                  <button
                    onClick={() => handleAssessTeamDeepDive(dossierChat)}
                    disabled={isAssessingDeep || dossierChat.length === 0}
                    className="w-full py-2.5 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-950/30 border border-red-900/40 text-red-500 hover:bg-red-950/50 hover:text-red-400 uppercase tracking-widest text-center"
                  >
                    Reforge Dossier from Chat
                  </button>
                  <button
                    onClick={handleExtractLesson}
                    disabled={isExtracting || isChatting || dossierChat.length === 0}
                    className="w-full py-2.5 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-red-800 hover:text-red-400 uppercase tracking-widest text-center"
                  >
                    {isExtracting ? "Extracting..." : "Extract Lesson to Memory"}
                  </button>
                  <button
                    onClick={handleClearChat}
                    disabled={isChatting || dossierChat.length === 0}
                    className="w-full py-1.5 rounded-xl font-bold text-[10px] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-transparent border border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-red-600 uppercase tracking-widest text-center"
                  >
                    Clear Chat
                  </button>
                </div>

                {/* Scrollable Message History */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                  {dossierChat.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-center p-6 text-zinc-500">
                      <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                        Challenge the Coach here.<br/>
                        Ask for contingencies or dispute threat matchups.
                      </p>
                    </div>
                  ) : (
                    dossierChat.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`max-w-[85%] rounded-2xl p-3.5 text-sm font-medium ${
                          msg.role === "user"
                            ? "bg-red-700/10 border border-red-900/30 text-zinc-200 self-end rounded-tr-none"
                            : "bg-zinc-900 border border-zinc-800 text-zinc-300 self-start rounded-tl-none"
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-wider block mb-1 opacity-60">
                          {msg.role === "user" ? "Challenger" : "VGC Coach"}
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))
                  )}
                  {isChatting && (
                    <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 self-start rounded-2xl rounded-tl-none p-3.5 max-w-[85%] flex items-center gap-2">
                      <div className="animate-pulse flex space-x-1">
                        <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                        <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                        <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                      </div>
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Coach is writing...</span>
                    </div>
                  )}
                </div>

                {/* Input Fixed at Bottom */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendChatMessage(); }}
                    disabled={isChatting}
                    placeholder="Ask the coach to pivot..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none"
                  />
                  <button
                    onClick={handleSendChatMessage}
                    disabled={isChatting || !chatInput.trim()}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 border border-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            {dossierData && !isAssessingDeep && (
              <div className="sticky bottom-0 z-10 bg-zinc-900/95 border-t border-zinc-800 px-6 py-4 flex justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDossierModal(false)}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 uppercase tracking-wider"
                  >
                    Close Dossier
                  </button>
                  <button
                    onClick={handleAssessTeamDeepDive}
                    disabled={isAssessingDeep}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-red-500 uppercase tracking-wider transition-all"
                  >
                    Regenerate Dossier
                  </button>
                </div>
                <div className="flex items-center gap-3 flex-1 justify-end">
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter Team Name..."
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm font-black uppercase tracking-widest focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full max-w-xs"
                  />
                  <button
                    onClick={() => handleSaveRoster(dossierData)}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl font-black text-sm bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] disabled:opacity-50 uppercase tracking-widest transition-all whitespace-nowrap"
                  >
                    {isSaving ? "Saving..." : "Save Roster & Assessment to Library"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

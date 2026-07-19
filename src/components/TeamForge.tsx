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
import { sanitizeText } from "../utils/sanitizeText";

interface TeamForgeProps {
  team: ParsedPokemon[];
  setTeam: React.Dispatch<React.SetStateAction<ParsedPokemon[]>>;
  session?: any;
}

export default function TeamForge({ team, setTeam, session }: TeamForgeProps) {
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
  const [dossierTab, setDossierTab] = useState<"cores" | "matchups" | "chat">("cores");

  // Dossier Sparring Chat States
  const [dossierChat, setDossierChat] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Let us craft a specialized strategy for this 6-Pokemon roster. What would you like to analyze first?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  // Auto-Optimize Teambuilder States
  const [preOptimizationState, setPreOptimizationState] = useState<ParsedPokemon[] | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<any[] | null>(null);

  // Synergy Scanner States
  const [isScanningSynergy, setIsScanningSynergy] = useState(false);
  const [synergyData, setSynergyData] = useState<{
    core_identity: string;
    type_vulnerabilities: string[];
    meta_threats: string[];
    suggested_tweaks: string[];
    legality_check?: boolean;
  } | null>(null);
  const [showSynergyPanel, setShowSynergyPanel] = useState(false);

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
      setDossierChat([
        { role: "assistant", content: "Let us craft a specialized strategy for this 6-Pokemon roster. What would you like to analyze first?" }
      ]); // Wiping chat clean upon successful regeneration
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
      if (!session?.user) {
        const localPayload = {
          id: Math.random().toString(36).substring(2, 11),
          rule_text: ruleText,
          is_active: true,
          created_at: new Date().toISOString()
        };
        const currentTactics = JSON.parse(localStorage.getItem("poke_learned_tactics") || "[]");
        currentTactics.unshift(localPayload);
        localStorage.setItem("poke_learned_tactics", JSON.stringify(currentTactics));
        alert("Lesson saved to Memory Bank (Local Save): " + ruleText);
        setIsExtracting(false);
        return;
      }

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
    setDossierChat([
      { role: "assistant", content: "Let us craft a specialized strategy for this 6-Pokemon roster. What would you like to analyze first?" }
    ]);
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

  const handleImport = () => {
    if (!paste.trim()) return;
    const parsed = parsePokePaste(paste);
    setTeam(parsed);
    setActiveEditIndex(null);
  };

  const handleOptimize = async () => {
    if (team.length === 0) return;
    setIsOptimizing(true);
    setPreOptimizationState([...team]);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, action: "optimize" })
      });
      
      const data = await res.json();
      
      if (data.optimized_team) {
        const localConvert = (sp: number) => {
          if (sp <= 0) return 0;
          if (sp >= 32) return 252;
          return (sp - 2) * 8 + 4;
        };

        const mappedTeam: ParsedPokemon[] = data.optimized_team.map((op: any) => {
          const rawSp = op.sp || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
          const spStats = {
            hp: Math.max(0, Math.min(Number(rawSp.hp) || 0, 32)),
            atk: Math.max(0, Math.min(Number(rawSp.atk) || 0, 32)),
            def: Math.max(0, Math.min(Number(rawSp.def) || 0, 32)),
            spa: Math.max(0, Math.min(Number(rawSp.spa) || 0, 32)),
            spd: Math.max(0, Math.min(Number(rawSp.spd) || 0, 32)),
            spe: Math.max(0, Math.min(Number(rawSp.spe) || 0, 32))
          };

          let total = Object.values(spStats).reduce((sum, v) => sum + v, 0);
          const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
          if (total > 66) {
            let diff = total - 66;
            while(diff > 0) {
              const highestStat = STATS.reduce((max, s) => spStats[s] > spStats[max] ? s : max, "hp" as const);
              spStats[highestStat] -= 1;
              diff--;
            }
          }

          const evStats = {
            hp: localConvert(spStats.hp),
            atk: localConvert(spStats.atk),
            def: localConvert(spStats.def),
            spa: localConvert(spStats.spa),
            spd: localConvert(spStats.spd),
            spe: localConvert(spStats.spe)
          };

          return {
            id: op.id || op.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: op.name,
            item: op.item || "",
            ability: op.ability || "",
            nature: op.nature || "",
            moves: Array.isArray(op.moves) ? op.moves.filter(Boolean) : [],
            sp: spStats,
            evs: evStats,
            spExplanations: op.spExplanations || {}
          };
        });

        setTeam(mappedTeam);
        setOptimizationReport(data.optimization_report || []);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to optimize team. Ensure AI_API_KEY is configured.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveRoster = async (dossierToSave?: any) => {
    console.log("--- SAVE ROSTER TRIGGERED ---");
    console.log("[TeamForge] team.length =", team.length, "| teamName =", JSON.stringify(teamName), "| supabase configured =", !!supabase);

    if (team.length !== 6) {
      const msg = `Cannot save: roster has ${team.length}/6 Pokemon. You need exactly 6 to save.`;
      console.warn("[TeamForge] Guard:", msg);
      alert(msg);
      return;
    }

    if (!teamName.trim()) {
      console.warn("[TeamForge] Guard: teamName is empty. Save aborted.");
      alert("Cannot save: please enter a Team Name in the field above the Save Roster button.");
      return;
    }

    setIsSaving(true);
    try {
      if (!session?.user) {
        // LocalStorage fallback
        const localPayload = {
          id: Math.random().toString(36).substring(2, 11),
          team_name: teamName,
          team_data: team,
          assessment_data: dossierToSave || dossierData || null,
          created_at: new Date().toISOString()
        };
        const currentTeams = JSON.parse(localStorage.getItem("poke_saved_teams") || "[]");
        currentTeams.unshift(localPayload);
        localStorage.setItem("poke_saved_teams", JSON.stringify(currentTeams));
        alert("Roster & Assessment saved successfully (Local Save)!");
        await refreshSavedTeams();
        return;
      }

      if (!supabase) {
        alert("Supabase client is null. Cannot complete cloud save.");
        return;
      }

      const payload: any = {
        team_name: teamName,
        team_data: team,
        user_id: session.user.id
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
    if (!session?.user) {
      // LocalStorage fallback
      const currentTeams = JSON.parse(localStorage.getItem("poke_saved_teams") || "[]");
      setSavedTeams(currentTeams);
      return;
    }

    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("saved_teams")
        .select("*")
        .eq("user_id", session.user.id)
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

  const handleDeleteRoster = async (id: any, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent loading the team when clicking delete
    if (!confirm("Are you sure you want to delete this roster?")) return;

    if (!session?.user) {
      // LocalStorage fallback
      const currentTeams = JSON.parse(localStorage.getItem("poke_saved_teams") || "[]");
      const updatedTeams = currentTeams.filter((t: any) => t.id !== id);
      localStorage.setItem("poke_saved_teams", JSON.stringify(updatedTeams));
      await refreshSavedTeams();
      return;
    }
    
    if (!supabase) return;
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
    setIsLoadingTeams(true);
    setShowLoadModal(true);

    try {
      await refreshSavedTeams();
    } finally {
      setIsLoadingTeams(false);
    }
  };

  /**
   * Defensive normalizer: ensures every Pokemon loaded from Supabase has
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
                <option value="reg_mb">Pokemon Champions (Reg M-B)</option>
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
              placeholder="Copy + paste from pokepast.es or Limitless VGC clipboard..."
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
                {isOptimizing ? "Optimizing..." : "Auto-Optimize Team"}
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
            {/* Analyze Team Synergy Button */}
            <button
              onClick={async () => {
                if (team.length < 4 || isScanningSynergy) return;
                setIsScanningSynergy(true);
                setSynergyData(null);
                try {
                  const res = await fetch("/api/coach", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "synergy", team })
                  });
                  if (!res.ok) throw new Error("Synergy scan failed.");
                  const data = await res.json();
                  setSynergyData(data);
                  setShowSynergyPanel(true);
                } catch (err: any) {
                  alert("Synergy scan error: " + err.message);
                } finally {
                  setIsScanningSynergy(false);
                }
              }}
              disabled={team.length < 4 || isScanningSynergy}
              className="col-span-2 py-3.5 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-amber-700 hover:bg-amber-600 border border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.15)] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isScanningSynergy ? (
                <><span className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent inline-block" />Scanning Synergy...</>
              ) : (
                <>⚡ Analyze Team Synergy</>
              )}
            </button>

            {synergyData && (
              <button
                onClick={() => setShowSynergyPanel(true)}
                className="col-span-2 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 bg-amber-950/30 border border-amber-900/30 text-amber-500 hover:bg-amber-950/50 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                Re-Open Synergy Report
              </button>
            )}

            {/* Run Deep Dive Assessment Button */}
            <button
              onClick={handleAssessTeamDeepDive}
              disabled={team.length !== 6 || isAssessingDeep}
              className="col-span-2 py-3.5 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isAssessingDeep ? "Running Deep Dive Assessment..." : "Run Deep Dive Assessment"}
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
              onClick={() => handleSaveRoster()}
              disabled={team.length !== 6 || isSaving}
              className="col-span-2 py-3 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.2)]"
            >
              {isSaving ? "Saving Roster..." : "Save Roster"}
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

      {/* —— Synergy Report Modal ——————————————————————————————————————————— */}
      {showSynergyPanel && synergyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-amber-900/40 rounded-3xl w-full max-w-2xl shadow-[0_0_40px_rgba(245,158,11,0.1)] max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-950/60 to-zinc-900 border-b border-amber-900/30 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-base font-black text-amber-400 uppercase tracking-widest">⚡ Synergy Scan Report</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Regulation M-B Structural Analysis</p>
              </div>
              <button onClick={() => setShowSynergyPanel(false)} className="text-zinc-500 hover:text-white transition-colors text-xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800">✕</button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Core Identity */}
              <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-2xl p-4">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Team Archetype</p>
                <p className="text-sm text-zinc-200 font-bold leading-relaxed">{synergyData.core_identity}</p>
              </div>

              {/* Type Vulnerabilities */}
              {synergyData.type_vulnerabilities.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">⚠ Type Weaknesses</p>
                  <div className="space-y-2">
                    {synergyData.type_vulnerabilities.map((v, i) => (
                      <div key={i} className="flex gap-3 items-start bg-amber-950/20 border border-amber-900/30 rounded-xl px-4 py-3">
                        <span className="text-amber-500 text-xs mt-0.5 flex-shrink-0">▲</span>
                        <p className="text-xs text-amber-200/90 leading-relaxed">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meta Threats */}
              {synergyData.meta_threats.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2">☠ Meta Threats</p>
                  <div className="space-y-2">
                    {synergyData.meta_threats.map((t, i) => (
                      <div key={i} className="flex gap-3 items-start bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3">
                        <span className="text-red-500 text-xs mt-0.5 flex-shrink-0">●</span>
                        <p className="text-xs text-red-200/90 leading-relaxed">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Tweaks */}
              {synergyData.suggested_tweaks.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest mb-2">✦ Suggested Fixes</p>
                  <div className="space-y-2">
                    {synergyData.suggested_tweaks.map((s, i) => (
                      <div key={i} className="flex gap-3 items-start bg-teal-950/20 border border-teal-900/30 rounded-xl px-4 py-3">
                        <span className="text-teal-400 text-xs mt-0.5 flex-shrink-0">→</span>
                        <p className="text-xs text-teal-200/90 leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800 px-6 py-4 flex-shrink-0">
              <button
                onClick={() => setShowSynergyPanel(false)}
                className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors border border-zinc-700"
              >
                Close Report
              </button>
            </div>
          </div>
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



      {/* Deep-Dive Assessment Dossier Modal */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-7xl shadow-2xl my-8 flex flex-col overflow-hidden max-h-[90vh]">
            
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

            {/* Loading State */}
            {isAssessingDeep && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center flex-1">
                <div className="animate-spin h-10 w-10 rounded-full border-4 border-red-500 border-t-transparent"></div>
                <p className="text-base font-bold uppercase tracking-wider text-red-500 animate-pulse">Forging Roster Dossier...</p>
                <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">Analyzing your 6-man roster with a heavy reasoning model to construct archetype cores, lead combos, and SP adjustments.</p>
              </div>
            )}

            {/* Tab Navigation + Content */}
            {!isAssessingDeep && (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Tab Bar */}
                <div className="flex border-b border-zinc-800 px-6 gap-1 bg-zinc-900/80 flex-shrink-0">
                  {([
                    { id: "cores", label: "Optimal Cores" },
                    { id: "matchups", label: "Meta Matchups" },
                    { id: "chat", label: "Coach Chat" },
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDossierTab(tab.id)}
                      className={`px-5 py-3.5 text-xs font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                        dossierTab === tab.id
                          ? "border-red-500 text-red-400"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content Area */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600">

                  {/* Tab 1: Optimal Cores */}
                  {dossierTab === "cores" && (
                    <div className="p-6">
                      {!dossierData ? (
                        <div className="text-center py-12 text-zinc-500 font-bold uppercase tracking-widest text-sm">No data loaded.</div>
                      ) : (
                        <div className="space-y-6 animate-fade-in">
                          {/* Red Flags */}
                          {dossierData.red_flags && dossierData.red_flags.length > 0 && (
                            <div className="bg-red-950/20 border-2 border-red-900/50 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_0_15px_rgba(220,38,38,0.15)]">
                              <div className="flex items-center gap-2 text-red-500 font-black uppercase tracking-widest text-xs">
                                <span>⚠</span><span>Glaring Weakness Alert</span>
                              </div>
                              <ul className="space-y-1.5 font-mono text-[11px] font-semibold text-zinc-200">
                                {dossierData.red_flags.map((flag: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2"><span className="text-red-500">•</span><span>{flag}</span></li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Team Grades */}
                          {dossierData.team_grades && (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
                              <h4 className="text-xs font-black text-red-500 uppercase tracking-widest font-mono">Team Grading Dashboard</h4>
                              <div className="space-y-3">
                                {[
                                  { name: "Offense", val: dossierData.team_grades.offense },
                                  { name: "Bulk", val: dossierData.team_grades.bulk },
                                  { name: "Speed Control", val: dossierData.team_grades.speed_control },
                                  { name: "Synergy", val: dossierData.team_grades.synergy },
                                ].map((g, i) => (
                                  <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider font-mono">
                                      <span className="text-zinc-400">{g.name}</span>
                                      <span className="text-red-500">{g.val || 0} / 100</span>
                                    </div>
                                    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-full h-2.5 overflow-hidden">
                                      <div className="bg-red-600 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(220,38,38,0.4)]" style={{ width: `${Math.max(0, Math.min(g.val || 0, 100))}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Core Identity */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-black text-red-500 uppercase tracking-widest border-l-4 border-red-600 pl-3">Core Identity & Strategy</h4>
                            <p className="text-base leading-relaxed text-zinc-200 font-medium">{sanitizeText(dossierData.core_identity)}</p>
                          </div>

                          {/* Optimal Cores Grid */}
                          {dossierData.optimal_cores && dossierData.optimal_cores.length > 0 && (
                            <div className="space-y-3">
                              <h4 className="text-sm font-black text-red-500 uppercase tracking-widest border-l-4 border-red-600 pl-3">Bring 6, Pick 4 — Optimal Cores</h4>
                              <p className="text-xs text-zinc-500 font-mono uppercase">Each core represents a distinct game plan you can select depending on the matchup.</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {dossierData.optimal_cores.map((core: any, cIdx: number) => (
                                  <div key={cIdx} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-red-900/40 transition-colors animate-fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-black text-red-400 uppercase tracking-widest">{core.core_name}</span>
                                      <span className="text-[9px] font-black bg-red-950/30 border border-red-900/30 text-red-500 rounded px-1.5 py-0.5 uppercase font-mono">Core {cIdx + 1}</span>
                                    </div>
                                    {/* Pokemon Sprites */}
                                    <div className="flex gap-3 justify-center flex-wrap">
                                      {(core.pokemon_lineup || []).map((monName: string, mIdx: number) => {
                                        const match = team.find((t: any) => t.name.toLowerCase() === monName.toLowerCase() || t.name.toLowerCase().includes(monName.toLowerCase()));
                                        const spriteUrl = match
                                          ? `https://play.pokemonshowdown.com/sprites/gen5/${match.id}.png`
                                          : `https://play.pokemonshowdown.com/sprites/gen5/${monName.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
                                        return (
                                          <div key={mIdx} className="flex flex-col items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-2 min-w-[72px]">
                                            <img src={spriteUrl} alt={monName} className="w-12 h-12 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
                                            <span className="text-[9px] font-black text-zinc-300 uppercase tracking-wide text-center truncate w-16">{monName}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    {/* Strategy Summary */}
                                    <p className="text-xs text-zinc-400 leading-relaxed italic border-t border-zinc-800/60 pt-3">{sanitizeText(core.strategy_summary)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Optimizations */}
                          {dossierData.optimizations && dossierData.optimizations.length > 0 && (
                            <div className="space-y-3 pt-4 border-t border-zinc-800/60">
                              <h4 className="text-sm font-black text-red-500 uppercase tracking-widest border-l-4 border-red-600 pl-3">Roster Tweaks & Optimizations</h4>
                              <div className="space-y-3">
                                {dossierData.optimizations.map((opt: any, i: number) => (
                                  <div key={i} className="bg-zinc-950 border border-red-900/30 rounded-2xl p-4 space-y-1.5">
                                    <span className="text-sm font-black text-red-500 uppercase tracking-widest">{opt.target_pokemon}</span>
                                    <p className="text-sm text-zinc-200 font-extrabold">{sanitizeText(opt.suggested_tweak)}</p>
                                    <p className="text-sm text-zinc-400 leading-relaxed italic">{sanitizeText(opt.rationale)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Meta Matchups */}
                  {dossierTab === "matchups" && (
                    <div className="p-6">
                      {!dossierData || !dossierData.meta_matchups ? (
                        <div className="text-center py-12 text-zinc-500 font-bold uppercase tracking-widest text-sm">No matchup data loaded.</div>
                      ) : (
                        <div className="space-y-4 animate-fade-in">
                          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Each matchup shows which of your 4 cores to select and the ruthless Turn 1 execution plan.</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {dossierData.meta_matchups.map((matchup: any, i: number) => (
                              <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-4 hover:border-red-900/40 transition-colors animate-fade-in">
                                {/* Archetype Header */}
                                <div className="flex justify-between items-start gap-2 border-b border-zinc-800/60 pb-3">
                                  <h5 className="text-sm font-black text-white uppercase tracking-wide leading-tight">{sanitizeText(matchup.opponent_archetype)}</h5>
                                  <span className="text-[8px] font-black text-red-400 bg-red-950/20 border border-red-900/35 rounded px-1.5 py-0.5 uppercase font-mono shrink-0">#{i + 1}</span>
                                </div>

                                {/* Recommended Core Badge */}
                                {matchup.recommended_core && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">Bring Core:</span>
                                    <span className="px-3 py-1 bg-red-700/20 border border-red-600/40 text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_8px_rgba(220,38,38,0.2)]">
                                      {sanitizeText(matchup.recommended_core)}
                                    </span>
                                  </div>
                                )}

                                {/* Play-by-Play (4-Turn Timeline) or legacy Turn 1 fallback */}
                                {matchup.play_by_play ? (
                                  <div className="space-y-2">
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest font-mono block">Play-by-Play:</span>
                                    {(["turn_1", "turn_2", "turn_3", "turn_4"] as const).map((key, tIdx) => {
                                      const turnText = matchup.play_by_play[key];
                                      if (!turnText) return null;
                                      const turnLabels = ["Turn 1", "Turn 2", "Turn 3", "Turn 4"];
                                      const turnColors = [
                                        "border-red-700/60 bg-red-950/20 text-red-400",
                                        "border-orange-700/50 bg-orange-950/15 text-orange-400",
                                        "border-yellow-700/40 bg-yellow-950/10 text-yellow-500",
                                        "border-zinc-600/50 bg-zinc-900/50 text-zinc-400",
                                      ];
                                      return (
                                        <div key={key} className={`flex gap-3 items-start rounded-xl border px-3 py-2.5 ${turnColors[tIdx]}`}>
                                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[9px] font-black text-zinc-300 mt-0.5">
                                            {tIdx + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <span className="text-[8px] font-black uppercase tracking-widest opacity-70 block mb-0.5">{turnLabels[tIdx]}</span>
                                            <p className="text-[11px] text-zinc-300 leading-relaxed font-semibold">{sanitizeText(turnText)}</p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : matchup.turn_1_plan ? (
                                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-1">
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest font-mono block">Turn 1 Plan:</span>
                                    <p className="text-xs text-zinc-300 leading-relaxed font-semibold">{sanitizeText(matchup.turn_1_plan)}</p>
                                  </div>
                                ) : null}

                                {/* Win Condition */}
                                {matchup.win_condition && (
                                  <div className="border-t border-zinc-800/60 pt-3">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono block mb-1">Win Condition:</span>
                                    <p className="text-xs text-zinc-400 leading-relaxed italic">{sanitizeText(matchup.win_condition)}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  {/* Tab 3: Coach Chat */}
                  {dossierTab === "chat" && (
                    <div className="max-h-[70vh] flex flex-col overflow-hidden bg-zinc-950/30">
                      {/* Reforge Action Header */}
                      <div className="p-4 border-b border-zinc-800 flex flex-col gap-2 bg-zinc-900/40 flex-shrink-0">
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
                              className={`max-w-[85%] rounded-2xl p-3.5 text-sm font-medium break-words whitespace-pre-wrap ${
                                msg.role === "user"
                                  ? "bg-red-700/10 border border-red-900/30 text-zinc-200 self-end rounded-tr-none"
                                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 self-start rounded-tl-none"
                              }`}
                            >
                              <span className="text-[10px] font-black uppercase tracking-wider block mb-1 opacity-60">
                                {msg.role === "user" ? "Challenger" : "VGC Coach"}
                              </span>
                              <p className="leading-relaxed whitespace-pre-wrap">{msg.role === "user" ? msg.content : sanitizeText(msg.content)}</p>
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

                      {/* Chat Input */}
                      <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex gap-2 flex-shrink-0">
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
                  )}

                </div>
              </div>
            )}

            {/* Footer */}
            {dossierData && !isAssessingDeep && (
              <div className="sticky bottom-0 z-10 bg-zinc-900/95 border-t border-zinc-800 px-6 py-4 flex justify-between items-center gap-3 flex-shrink-0">
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
    {/* Auto-Optimize Team Report Modal Overlay */}
    {/* Auto-Optimize Team Report Modal Overlay */}
      {optimizationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl shadow-2xl p-6 md:p-8 flex flex-col max-h-[85vh] relative overflow-hidden">
            
            {/* Ambient Red glow background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-750/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col gap-1 border-b border-zinc-800 pb-4">
              <h3 className="text-xl font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                <span>Roster Optimization Report</span>
              </h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                Coach optimized spreads, filled roster gaps, and adjusted sets for competitive viability.
              </p>
            </div>

            {/* Scrollable Report Content */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 my-6">
              {optimizationReport.map((rep, idx) => (
                <div 
                  key={idx} 
                  className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-zinc-800 transition-colors"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-650" />
                  
                  <h4 className="text-sm font-black text-white uppercase tracking-wider pl-1">
                    {rep.pokemon}
                  </h4>
                  
                  <div className="space-y-1.5 pl-1">
                    <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono block">Changes Made</span>
                    <ul className="space-y-1 text-xs text-zinc-300 font-medium">
                      {rep.changes?.map((change: string, cIdx: number) => (
                        <li key={cIdx} className="flex items-start gap-2.5">
                          <span className="text-red-500 font-bold font-mono">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {rep.rationale && (
                    <div className="bg-zinc-900/30 border border-zinc-850/60 rounded-xl p-3 pl-4">
                      <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono block mb-1">Strategic Rationale</span>
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">
                        {rep.rationale}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions Footer */}
            <div className="border-t border-zinc-800 pt-4 flex flex-wrap justify-between items-center gap-3">
              <button
                onClick={() => {
                  if (preOptimizationState) {
                    setTeam(preOptimizationState);
                  }
                  setOptimizationReport(null);
                  setPreOptimizationState(null);
                }}
                className="px-5 py-3 rounded-xl font-black text-xs transition-all duration-300 bg-zinc-900 border border-zinc-700 text-zinc-350 hover:text-white uppercase tracking-widest cursor-pointer"
              >
                Revert to Original
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setOptimizationReport(null);
                    handleAssessTeamDeepDive();
                  }}
                  className="px-5 py-3 rounded-xl font-black text-xs transition-all duration-300 bg-red-950/20 border border-red-900/40 text-red-500 hover:bg-red-950/45 hover:text-red-400 uppercase tracking-widest cursor-pointer"
                >
                  Run Deep Dive Assessment
                </button>

                <button
                  onClick={() => {
                    setOptimizationReport(null);
                    setPreOptimizationState(null);
                  }}
                  className="px-6 py-3 bg-red-700 hover:bg-red-600 border border-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 shadow-[0_0_15px_rgba(220,38,38,0.15)] cursor-pointer"
                >
                  Accept Optimization
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

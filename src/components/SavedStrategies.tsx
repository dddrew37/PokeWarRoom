"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import LivePlaybook from "./LivePlaybook";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

export default function SavedStrategies() {
  const [activeTab, setActiveTab] = useState<"playbooks" | "dossiers">("playbooks");
  const [strategies, setStrategies] = useState<any[]>([]);
  const [savedDossiers, setSavedDossiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedDossier, setSelectedDossier] = useState<any>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSaved = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setIsRefreshing(true);
    try {
      // 1. Fetch saved strategies (mid-match playbooks)
      const { data: stratData, error: stratError } = await supabase
        .from("saved_strategies")
        .select("*")
        .order("created_at", { ascending: false });

      if (stratError) {
        console.error("[Supabase] saved_strategies SELECT error:", stratError);
        alert("Failed to load saved strategies: " + stratError.message);
      }
      if (stratData) setStrategies(stratData);

      // 2. Fetch saved teams (dossiers) where assessment_data is not null
      const { data: teamData, error: teamError } = await supabase
        .from("saved_teams")
        .select("*")
        .not("assessment_data", "is", null)
        .order("created_at", { ascending: false });

      if (teamError) {
        console.error("[Supabase] saved_teams SELECT error:", teamError);
        alert("Failed to load saved dossiers: " + teamError.message);
      }
      if (teamData) setSavedDossiers(teamData);

    } catch (err: unknown) {
      console.error("[Supabase] Universal Library SELECT exception:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to load library items: " + message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (selected) {
    return <LivePlaybook team={selected.team} data={selected.playbook} onBack={() => setSelected(null)} readOnly={true} />;
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-white">War Room Books</h2>
        <p className="text-zinc-400 text-sm font-medium">Your saved tactical configurations</p>
        <button
          onClick={fetchSaved}
          disabled={isRefreshing}
          className="mt-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Sleek eSports Toggle */}
      <div className="flex bg-black p-1.5 rounded-2xl border-2 border-zinc-850 shadow-inner w-full max-w-md mx-auto">
        <button
          onClick={() => setActiveTab("playbooks")}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
            activeTab === "playbooks"
              ? "bg-red-950/20 text-red-500 shadow-sm border border-red-900/40"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Mid-Match Playbooks
        </button>
        <button
          onClick={() => setActiveTab("dossiers")}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${
            activeTab === "dossiers"
              ? "bg-red-950/20 text-red-500 shadow-sm border border-red-900/40"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Pre-Game Dossiers
        </button>
      </div>

      {!supabase && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm font-bold">Supabase not configured. Set environment variables to enable library saving.</p>
        </div>
      )}

      {loading && supabase && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-red-500 border-t-transparent"></div>
        </div>
      )}

      {/* View list for strategies */}
      {!loading && activeTab === "playbooks" && strategies.length === 0 && supabase && (
        <div className="bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No Saved Books</p>
        </div>
      )}

      {!loading && activeTab === "playbooks" && strategies.length > 0 && (
        <div className="space-y-4">
          {strategies.map((strat) => (
            <div 
              key={strat.id} 
              onClick={() => setSelected(strat)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-red-600/50 transition-all shadow-lg flex items-center justify-between group"
            >
              <div>
                <h3 className="text-lg font-black text-white">{strat.title}</h3>
                <p className="text-xs text-zinc-500 font-bold mt-1 uppercase tracking-wider">
                  {new Date(strat.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex -space-x-2">
                {strat.team.slice(0, 3).map((p: any, i: number) => (
                  <img 
                    key={i} 
                    src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                    alt={p.name} 
                    className="w-8 h-8 object-contain rounded-full bg-zinc-800 border-2 border-zinc-900 drop-shadow-md" 
                    onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                  />
                ))}
                {strat.team.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black text-white relative z-10">
                    +{strat.team.length - 3}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View list for Pre-Game Dossiers */}
      {!loading && activeTab === "dossiers" && savedDossiers.length === 0 && supabase && (
        <div className="bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No Saved Dossiers</p>
        </div>
      )}

      {!loading && activeTab === "dossiers" && savedDossiers.length > 0 && (
        <div className="space-y-4">
          {savedDossiers.map((dossier) => (
            <div 
              key={dossier.id} 
              onClick={() => setSelectedDossier(dossier)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-red-600/50 transition-all shadow-lg flex items-center justify-between group"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white group-hover:text-red-500 transition-colors">{dossier.team_name}</h3>
                  <span className="px-1.5 py-0.5 bg-red-950/40 text-red-500 border border-red-900/50 rounded text-[9px] font-black uppercase tracking-widest">
                    Dossier
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-bold mt-1 uppercase tracking-wider">
                  {new Date(dossier.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex -space-x-2">
                {dossier.team_data?.slice(0, 3).map((p: any, i: number) => (
                  <img 
                    key={i} 
                    src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                    alt={p.name} 
                    className="w-8 h-8 object-contain rounded-full bg-zinc-800 border-2 border-zinc-900 drop-shadow-md" 
                    onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                  />
                ))}
                {dossier.team_data?.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-black text-white relative z-10">
                    +{dossier.team_data.length - 3}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Massive Dossier Viewer Modal */}
      {selectedDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col overflow-hidden max-h-[90vh]">
            
            {/* Header */}
            <div className="sticky top-0 z-10 bg-zinc-900/90 backdrop-blur-md px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="text-2xl font-black text-red-500 flex items-center gap-2 tracking-wider uppercase">
                <span>Roster Study Dossier: {selectedDossier.team_name}</span>
              </h3>
              <button 
                onClick={() => setSelectedDossier(null)}
                className="text-zinc-500 hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-zinc-300 leading-relaxed max-h-[70vh]">
              <div className="space-y-6">
                {/* Red Flags / Glaring Weaknesses */}
                {selectedDossier.assessment_data.red_flags && selectedDossier.assessment_data.red_flags.length > 0 && (
                  <div className="bg-red-950/20 border-2 border-red-650 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_0_15px_rgba(220,38,38,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-full bg-red-700/5 blur-3xl pointer-events-none" />
                    <div className="flex items-center gap-2 text-red-500 font-black uppercase tracking-widest text-xs font-mono">
                      <span>⚠️</span>
                      <span>Glaring Weakness Alert</span>
                    </div>
                    <ul className="space-y-2 font-mono text-[11px] font-semibold text-zinc-200">
                      {selectedDossier.assessment_data.red_flags.map((flag: string, i: number) => (
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
                    {selectedDossier.assessment_data.core_identity}
                  </p>
                </div>

                {/* Primary Modes */}
                <div className="space-y-4 pt-6 border-t border-zinc-800/60">
                  <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Primary Operational Modes</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedDossier.assessment_data.primary_modes?.map((mode: any, i: number) => (
                      <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <h5 className="text-lg font-black text-white border-b border-zinc-850 pb-2 tracking-wide">{mode.mode_name}</h5>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-zinc-500 font-extrabold uppercase tracking-widest">Leads:</span>
                          {mode.lead_duo?.map((mon: string, mIdx: number) => (
                            <span key={mIdx} className="bg-zinc-900 border border-zinc-750 text-zinc-200 font-bold px-2 py-0.5 rounded-lg text-xs">
                              {mon}
                            </span>
                          ))}
                        </div>
                        <p className="text-base text-zinc-400 leading-relaxed">{mode.objective}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Threat Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-800/60">
                  <div className="space-y-3 bg-zinc-950 border border-zinc-850 p-5 rounded-2xl">
                    <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3 flex items-center gap-1">
                      <span>Favorable Matchups</span>
                    </h4>
                    <ul className="space-y-2">
                      {selectedDossier.assessment_data.threat_matrix?.favorable_matchups?.map((matchup: string, i: number) => (
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
                      {selectedDossier.assessment_data.threat_matrix?.critical_vulnerabilities?.map((vuln: string, i: number) => (
                        <li key={i} className="text-base text-zinc-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-red-500/40 mt-0.5">•</span>
                          <span>{vuln}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Detailed Matchup Tactics */}
                {selectedDossier.assessment_data.detailed_tactics && selectedDossier.assessment_data.detailed_tactics.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-zinc-800/60">
                    <h4 className="text-base font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Detailed Matchup Tactics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedDossier.assessment_data.detailed_tactics.map((tactic: any, i: number) => (
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
                    {selectedDossier.assessment_data.optimizations?.map((opt: any, i: number) => (
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
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 z-10 bg-zinc-900/95 border-t border-zinc-800 px-6 py-4 flex justify-end">
              <button
                onClick={() => setSelectedDossier(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 uppercase tracking-wider"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

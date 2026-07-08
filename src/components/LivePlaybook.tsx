"use client";

import { useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { Pokemon } from "../lib/pokemon";

export interface PlaybookData {
  audit: {
    team_identity: string;
    preserve_targets: string[];
    top_findings: string;
  };
  primary_win_condition?: FlowchartNode;
  contingency_plans?: FlowchartNode[];
  default_leads?: string[]; // kept for backwards compatibility with old saves
  flowcharts?: FlowchartNode[]; // kept for backwards compatibility
}

export interface FlowchartNode {
  path_name?: string;
  matchup_condition?: string; // backwards compatibility
  leads: string[];
  in_the_back: string[];
  turns: DoubleTurnNode[];
}

export interface PlayerAction {
  pokemon: string;
  action: string;
  target: string;
  damage_estimation?: string;
  mechanic_trigger?: string;
}

export interface DoubleTurnNode {
  turn_number?: number;
  turn?: number; // backwards compatibility
  player_actions: PlayerAction[];
  expected_board_state: string;
  tactical_rationale: string;
}

export default function LivePlaybook({ 
  team, 
  data, 
  onBack, 
  readOnly = false 
}: { 
  team: Pokemon[], 
  data: PlaybookData, 
  onBack: () => void,
  readOnly?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Aggregate the primary win condition and contingency plans into a single array for rendering
  const allPaths = useMemo(() => {
    let paths: FlowchartNode[] = [];
    if (data.primary_win_condition) {
      paths.push({
        ...data.primary_win_condition,
        path_name: data.primary_win_condition.path_name || "Primary Win Condition"
      });
    }
    if (data.contingency_plans && data.contingency_plans.length > 0) {
      paths = paths.concat(data.contingency_plans);
    }
    // Fallback for older saves
    if (paths.length === 0 && data.flowcharts && data.flowcharts.length > 0) {
      paths = data.flowcharts;
    }
    return paths;
  }, [data]);

  const activeFlowchart = allPaths[activeIndex];
  const nodes = activeFlowchart?.turns || [];

  const handleSave = async () => {
    if (!supabase) {
      alert("Supabase not configured in .env! Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const title = prompt("Name this Strategy (e.g. Vs Hard Trick Room):");
    if (!title) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("saved_strategies").insert([{
        title,
        team,
        playbook: data
      }]);

      if (error) {
        console.error("[Supabase] saved_strategies INSERT error:", error);
        alert("Save failed: " + error.message);
      } else {
        alert("Strategy saved successfully!");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Save failed: " + message);
      console.error("[Supabase] saved_strategies INSERT exception:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-screen h-fit overflow-y-auto bg-zinc-950 -mt-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-950 sticky top-0 z-50">
        <button 
          onClick={onBack} 
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800"
        >
          ← Return to Roster
        </button>
        <div className="flex items-center gap-3 text-right">
          {!readOnly && (
            <button onClick={handleSave} disabled={isSaving} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(5,150,105,0.3)] border border-emerald-500 transition-colors uppercase tracking-wider disabled:opacity-50">
              {isSaving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>

      {/* Audit Intel Banner */}
      {data.audit && (
        <div className="px-6 pb-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 shadow-inner space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-bold mb-2">VGC Audit Findings</h4>
            <p className="text-sm text-zinc-300 font-medium mb-4 leading-relaxed">{data.audit.top_findings}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-bold">PRESERVE:</span>
              <div className="flex gap-1 flex-wrap">
                {data.audit.preserve_targets?.map((t, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded text-[9px] font-black uppercase tracking-wider">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header Toggle */}
      <div className="sticky top-[68px] z-50 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 p-6 pt-4 shadow-sm">
        <div className="flex flex-col gap-2 mb-3">
          {/* Primary Win Condition Tab (Index 0) */}
          {allPaths.length > 0 && (
            <button
              onClick={() => setActiveIndex(0)}
              className={`w-full py-2.5 px-3 text-left rounded-xl transition-all border flex items-center justify-between ${
                activeIndex === 0
                  ? "bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <div>
                <div className={`text-[9px] font-bold uppercase tracking-widest ${activeIndex === 0 ? "text-amber-500" : "text-zinc-600"}`}>Primary Win Condition</div>
                <div className={`text-sm font-black tracking-wide truncate ${activeIndex === 0 ? "text-amber-100" : "text-zinc-400"}`}>
                  {allPaths[0].path_name || allPaths[0].matchup_condition || "Default Matchup"}
                </div>
              </div>
              {activeIndex === 0 && <span className="text-amber-500 font-bold text-xs uppercase tracking-widest">Active</span>}
            </button>
          )}

          {/* Contingency Plans Tabs (Index 1+) */}
          {allPaths.length > 1 && (
            <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 shadow-inner overflow-x-auto no-scrollbar">
              {allPaths.slice(1).map((path, idx) => {
                const actualIndex = idx + 1;
                const isActive = activeIndex === actualIndex;
                return (
                  <button
                    key={actualIndex}
                    onClick={() => setActiveIndex(actualIndex)}
                    className={`flex-1 min-w-[120px] py-2 px-2 text-center rounded-lg transition-all ${
                      isActive
                        ? "bg-blue-900/40 border border-blue-700/50 shadow-md"
                        : "hover:bg-zinc-800"
                    }`}
                  >
                    <div className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? "text-blue-400/80" : "text-zinc-600"}`}>
                      Contingency {actualIndex}
                    </div>
                    <div className={`text-xs font-black truncate mt-0.5 ${isActive ? "text-blue-100" : "text-zinc-500"}`}>
                      {path.path_name || path.matchup_condition || `Path ${actualIndex + 1}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dynamic Leads Display */}
        {activeFlowchart && activeFlowchart.leads && (
          <div className="flex justify-between items-center text-center animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex-1 bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-2 mr-2">
              <p className="text-[9px] font-bold tracking-widest uppercase text-emerald-500 mb-0.5">Leads</p>
              <p className="text-xs font-black text-white">{activeFlowchart.leads.join(" + ")}</p>
            </div>
            <div className="flex-1 bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-2 ml-2">
              <p className="text-[9px] font-bold tracking-widest uppercase text-purple-500 mb-0.5">In The Back</p>
              <p className="text-xs font-black text-white">{(activeFlowchart.in_the_back || []).join(" + ")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 p-6 space-y-8 pb-32 pt-6 relative">
        {nodes.map((node, i) => {
          const isSticky = i < 2;
          const stickyTop = 230 + (i * 160); // Adjusted height for taller Double nodes with badges
          const turnNumber = node.turn_number || node.turn || i + 1;

          return (
            <div 
              key={i} 
              className={`relative pl-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ${isSticky ? 'sticky z-40' : 'z-30'}`} 
              style={{ 
                animationFillMode: 'both', 
                animationDelay: (i * 100) + 'ms',
                top: isSticky ? `${stickyTop}px` : 'auto'
              }}
            >
              {/* Timeline Line */}
              {i !== nodes.length - 1 && (
                <div className="absolute top-6 bottom-[-20px] left-[11px] w-0.5 bg-zinc-800" />
              )}
              {/* Timeline Dot */}
              <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-zinc-950 flex items-center justify-center text-[10px] font-black shadow-sm ${activeIndex === 0 ? "bg-amber-500 text-white" : "bg-blue-500 text-white"}`}>
                {turnNumber}
              </div>

              <div className={`bg-zinc-900/95 backdrop-blur-md border rounded-2xl p-6 shadow-lg hover:border-zinc-700 transition-colors ${activeIndex === 0 ? "border-amber-900/30" : "border-zinc-800"}`}>
                
                {/* Fallback for old single-turn schema saves */}
                {!node.player_actions && (node as any).action && (
                  <div className="mb-2">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <h3 className="text-base font-black text-white leading-tight">{(node as any).action}</h3>
                      <span className="bg-zinc-950 text-zinc-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-zinc-800 uppercase tracking-widest whitespace-nowrap">
                        tgt: {(node as any).target}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-xs font-medium leading-snug">{(node as any).reasoning}</p>
                  </div>
                )}

                {/* New VGC Doubles Grid with Micro-Granularity */}
                {node.player_actions && (
                  <div className="space-y-3 mb-3">
                    {node.player_actions.map((act, idx) => (
                      <div key={idx} className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{act.pokemon}</span>
                            <span className="text-sm font-black text-white leading-none mt-0.5">{act.action}</span>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Target</span>
                            <span className="text-xs font-bold text-red-400/90">{act.target}</span>
                          </div>
                        </div>
                        {/* Micro-Granularity Badges */}
                        {(act.damage_estimation || act.mechanic_trigger) && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/50">
                            {act.damage_estimation && act.damage_estimation.toLowerCase() !== "none" && (
                              <span className="px-1.5 py-0.5 bg-red-950/40 text-red-400 border border-red-900/50 rounded text-[8px] font-bold uppercase tracking-widest">
                                ⚔️ {act.damage_estimation}
                              </span>
                            )}
                            {act.mechanic_trigger && act.mechanic_trigger.toLowerCase() !== "none" && (
                              <span className="px-1.5 py-0.5 bg-indigo-950/40 text-indigo-400 border border-indigo-900/50 rounded text-[8px] font-bold uppercase tracking-widest">
                                ⚙️ {act.mechanic_trigger}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Macro Context */}
                {node.expected_board_state && (
                  <div className="border-t border-zinc-800/80 pt-2 mt-1">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Expected Board State</p>
                    <p className="text-xs text-zinc-300 italic mb-2">{node.expected_board_state}</p>
                    
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Tactical Rationale</p>
                    <p className="text-xs font-medium text-emerald-400/90">{node.tactical_rationale}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

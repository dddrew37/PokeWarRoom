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
  decision_audit?: {
    speed_tier_analysis: string;
    primary_threat_identified: string;
    risk_assessment_justification: string;
  };
  primary_win_condition?: FlowchartNode;
  contingency_plans?: FlowchartNode[];
  default_leads?: string[]; // kept for backwards compatibility with old saves
  flowcharts?: FlowchartNode[]; // kept for backwards compatibility
  red_flags?: string[];
  team_grades?: {
    offense: number;
    bulk: number;
    speed_control: number;
    synergy: number;
  };
}

export interface DeepDiveData {
  draft_justification: string;
  potential_weaknesses: string[];
  things_to_watch_out_for: string[];
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
  readOnly = false,
  onNextTurn
}: { 
  team: Pokemon[], 
  data: PlaybookData, 
  onBack: () => void,
  readOnly?: boolean,
  onNextTurn?: (context: string) => Promise<void>
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAuditLogic, setShowAuditLogic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matchContext, setMatchContext] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Deep Dive state
  const [deepDiveData, setDeepDiveData] = useState<DeepDiveData | null>(null);
  const [isDeepDiving, setIsDeepDiving] = useState(false);

  // Match Debrief States
  const [showDebriefModal, setShowDebriefModal] = useState(false);
  const [debriefOutcome, setDebriefOutcome] = useState<"won" | "lost">("won");
  const [debriefNotes, setDebriefNotes] = useState("");
  const [isSubmittingDebrief, setIsSubmittingDebrief] = useState(false);

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

  const handleDeepDive = async () => {
    if (!activeFlowchart) return;
    setIsDeepDiving(true);
    setDeepDiveData(null);
    try {
      const payload = {
        action: "deepdive",
        team, // Opponent team
        playerLockedRoster: [...(activeFlowchart.leads || []), ...(activeFlowchart.in_the_back || [])]
      };
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDeepDiveData(data);
    } catch (e) {
      console.error("Deep Dive Error:", e);
      alert("Failed to fetch Deep Dive. Check console.");
    } finally {
      setIsDeepDiving(false);
    }
  };

  const handleDebriefSubmit = async () => {
    if (isSubmittingDebrief || !debriefNotes.trim()) return;
    setIsSubmittingDebrief(true);
    try {
      // Step 1: Request match_debrief to extract tactic rule
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "match_debrief",
          playbook: data,
          outcome: debriefOutcome,
          notes: debriefNotes
        })
      });
      const resData = await res.json();
      if (resData.error) throw new Error(resData.error);

      const ruleText: string = (resData.message || "").trim();

      if (!ruleText || ruleText === "NO_RULE") {
        alert("No definitive rule detected from your debrief notes.");
        return;
      }

      // Step 2: Post to memory database
      const saveRes = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule_text: ruleText })
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save to Memory Bank.");

      alert(`Match debrief logged. Saved tactical override to Memory Bank:\n\n${ruleText}`);
      
      // Reset state and close modal
      setDebriefNotes("");
      setShowDebriefModal(false);
    } catch (e) {
      console.error("[LivePlaybook] Debrief submission failed:", e);
      alert("Failed to submit debrief. Check browser console for logs.");
    } finally {
      setIsSubmittingDebrief(false);
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
          Return to Roster
        </button>
        <div className="flex items-center gap-3 text-right">
          {!readOnly && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowDebriefModal(true)}
                className="text-xs bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-white font-black px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest cursor-pointer"
              >
                Log Match Debrief
              </button>
              <button onClick={handleSave} disabled={isSaving} className="text-xs bg-red-700 hover:bg-red-600 border border-red-500 text-white font-black px-3 py-1.5 rounded-lg shadow-[0_0_15px_rgba(220,38,38,0.2)] transition-colors uppercase tracking-widest disabled:opacity-50 transition-all">
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
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
                  <span key={i} className="px-1.5 py-0.5 bg-red-950/20 text-red-500 border border-red-900/30 rounded text-[9px] font-black uppercase tracking-wider">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Decision Logic Audit */}
      {data.decision_audit && (
        <div className="px-6 pb-6">
          <button 
            onClick={() => setShowAuditLogic(!showAuditLogic)}
            className="flex items-center gap-2 text-[11px] font-black tracking-widest uppercase text-zinc-500 hover:text-zinc-300 transition-colors mb-4"
          >
            {showAuditLogic ? "▼" : "▶"} Audit AI Logic
          </button>
          
          {showAuditLogic && (
            <div className="bg-black/80 border border-zinc-800/80 rounded-2xl p-6 font-mono text-xs space-y-6 shadow-inner animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <span className="text-red-500 font-bold block mb-2 uppercase tracking-widest text-[10px]">&gt; speed_tier_analysis</span>
                <p className="text-zinc-400 leading-relaxed">{data.decision_audit.speed_tier_analysis}</p>
              </div>
              <div className="border-t border-zinc-800/50 pt-4">
                <span className="text-red-500 font-bold block mb-2 uppercase tracking-widest text-[10px]">&gt; primary_threat_identified</span>
                <p className="text-zinc-400 leading-relaxed">{data.decision_audit.primary_threat_identified}</p>
              </div>
              <div className="border-t border-zinc-800/50 pt-4">
                <span className="text-zinc-500 font-bold block mb-2 uppercase tracking-widest text-[10px]">&gt; risk_assessment_justification</span>
                <p className="text-zinc-400 leading-relaxed">{data.decision_audit.risk_assessment_justification}</p>
              </div>
            </div>
          )}
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
                  ? "bg-red-950/20 border-red-800 shadow-[0_0_10px_rgba(220,38,38,0.1)]"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              }`}
            >
              <div>
                <div className={`text-[9px] font-bold uppercase tracking-widest ${activeIndex === 0 ? "text-red-500" : "text-zinc-600"}`}>Primary Win Condition</div>
                <div className={`text-sm font-black tracking-wide truncate ${activeIndex === 0 ? "text-white" : "text-zinc-400"}`}>
                  {allPaths[0].path_name || allPaths[0].matchup_condition || "Default Matchup"}
                </div>
              </div>
              {activeIndex === 0 && <span className="text-red-500 font-bold text-xs uppercase tracking-widest">Active</span>}
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
                        ? "bg-red-950/20 border border-red-900/30 shadow-md"
                        : "hover:bg-zinc-800"
                    }`}
                  >
                    <div className={`text-[9px] font-bold uppercase tracking-widest ${isActive ? "text-red-500" : "text-zinc-600"}`}>
                      Contingency {actualIndex}
                    </div>
                    <div className={`text-xs font-black truncate mt-0.5 ${isActive ? "text-white" : "text-zinc-500"}`}>
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
              <p className="text-[9px] font-bold tracking-widest uppercase text-red-500 mb-0.5">Leads</p>
              <p className="text-xs font-black text-white">{activeFlowchart.leads.join(" + ")}</p>
            </div>
            <div className="flex-1 bg-zinc-900/50 border border-zinc-800/80 rounded-lg p-2 ml-2">
              <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-500 mb-0.5">In The Back</p>
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
              <div className="absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-zinc-950 flex items-center justify-center text-[10px] font-black shadow-sm bg-red-750 text-white">
                {turnNumber}
              </div>

              <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-lg hover:border-zinc-750 transition-colors">
                
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
                            <span className="text-xs font-bold text-red-500">{act.target}</span>
                          </div>
                        </div>
                        {/* Micro-Granularity Badges */}
                        {(act.damage_estimation || act.mechanic_trigger) && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/50">
                            {act.damage_estimation && act.damage_estimation.toLowerCase() !== "none" && (
                              <span className="px-1.5 py-0.5 bg-red-950/40 text-red-500 border border-red-900/50 rounded text-[8px] font-bold uppercase tracking-widest">
                                {act.damage_estimation}
                              </span>
                            )}
                            {act.mechanic_trigger && act.mechanic_trigger.toLowerCase() !== "none" && (
                              <span className="px-1.5 py-0.5 bg-zinc-850 text-zinc-400 border border-zinc-800 rounded text-[8px] font-bold uppercase tracking-widest">
                                {act.mechanic_trigger}
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
                    <p className="text-xs font-medium text-zinc-400">{node.tactical_rationale}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Deep Dive Assessment */}
      <div className="px-6 pb-6 pt-4 flex flex-col gap-6 items-center border-t border-zinc-800/50">
        {!deepDiveData && (
          <button
            onClick={handleDeepDive}
            disabled={isDeepDiving}
            className="w-full max-w-sm py-3 rounded-xl font-black text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            {isDeepDiving ? "Analyzing..." : "Explain Further (Deep Dive)"}
          </button>
        )}

        {deepDiveData && (
          <div className="w-full bg-black border border-zinc-850 rounded-2xl p-6 shadow-inner space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                Draft Justification
              </h4>
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                {deepDiveData.draft_justification}
              </p>
            </div>
            
            <div className="border-t border-zinc-850 pt-4">
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                Potential Weaknesses
              </h4>
              <ul className="space-y-2">
                {deepDiveData.potential_weaknesses?.map((weakness, i) => (
                  <li key={i} className="text-sm text-zinc-400 flex items-start gap-2 leading-tight">
                    <span className="text-red-500/40 mt-0.5">•</span> {weakness}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="border-t border-zinc-850 pt-4">
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                Things To Watch Out For
              </h4>
              <ul className="space-y-2">
                {deepDiveData.things_to_watch_out_for?.map((threat, i) => (
                  <li key={i} className="text-sm text-zinc-400 flex items-start gap-2 leading-tight">
                    <span className="text-red-500/40 mt-0.5">•</span> {threat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Mid-Match Terminal */}
      {onNextTurn && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-950 sticky bottom-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Update Board State (What just happened?)
          </label>
          <div className="flex flex-col gap-3">
            <textarea
              value={matchContext}
              onChange={(e) => setMatchContext(e.target.value)}
              placeholder="Update board state (What just happened?) to recalculate actual Turn 2+..."
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-zinc-600 resize-none min-h-[80px]"
              disabled={isUpdating}
            />
            <button
              onClick={async () => {
                if (!matchContext.trim()) return;
                setIsUpdating(true);
                await onNextTurn(matchContext);
                setIsUpdating(false);
                setMatchContext(""); // clear on success
              }}
              disabled={isUpdating || !matchContext.trim()}
              className="w-full py-3 rounded-xl font-black text-sm transition-all duration-300 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border-2 disabled:cursor-not-allowed bg-red-700 border-red-500 text-white hover:bg-red-600 hover:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)] disabled:shadow-none uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              {isUpdating ? "Recalculating..." : "Calculate Next Turn"}
            </button>
          </div>
        </div>
      )}
      {/* Debrief Modal Overlay */}
      {showDebriefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-250">
            <div>
              <h3 className="text-lg font-black text-red-500 uppercase tracking-widest font-mono">Log Match Debrief</h3>
              <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest font-mono mt-1">Post-match analytical learning pipeline</p>
            </div>

            {/* Outcome toggle button group */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Match Outcome</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDebriefOutcome("won")}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all cursor-pointer ${
                    debriefOutcome === "won"
                      ? "bg-green-950/45 border-green-700 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-350"
                  }`}
                >
                  Won Match
                </button>
                <button
                  type="button"
                  onClick={() => setDebriefOutcome("lost")}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all cursor-pointer ${
                    debriefOutcome === "lost"
                      ? "bg-red-950/45 border-red-700 text-red-400 shadow-[0_0_12px_rgba(220,38,38,0.15)]"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-350"
                  }`}
                >
                  Lost Match
                </button>
              </div>
            </div>

            {/* Observations text area */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">What Happened?</label>
              <textarea
                value={debriefNotes}
                onChange={(e) => setDebriefNotes(e.target.value)}
                placeholder="E.g., Turn 1 Tailwind got countered by opponent's Trick Room setup."
                className="w-full bg-zinc-950 border-2 border-zinc-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-zinc-600 resize-none min-h-[100px]"
                disabled={isSubmittingDebrief}
              />
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setDebriefNotes("");
                  setShowDebriefModal(false);
                }}
                disabled={isSubmittingDebrief}
                className="py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-zinc-950 border border-zinc-800 text-zinc-450 hover:text-white hover:border-zinc-650 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDebriefSubmit}
                disabled={isSubmittingDebrief || !debriefNotes.trim()}
                className="py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-red-700 border border-red-500 text-white hover:bg-red-650 shadow-[0_0_15px_rgba(220,38,38,0.25)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmittingDebrief ? "Analyzing..." : "Submit Debrief"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

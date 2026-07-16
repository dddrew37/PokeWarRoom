"use client";

import { useState } from "react";
import { ParsedPokemon, parsePokePaste } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtractedPokemon {
  id: string;
  name: string;
  item: string;
  ability: string;
  nature: string;
  moves: string[];
  sp: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number };
}

interface ExtractedTactic {
  title: string;
  matchup_summary: string;
  primary_win_condition: { core_strategy: string; lead_pairing: string };
  turn_by_turn: { turn_number: number; player_actions: string[]; expected_board_state: string }[];
}

interface ExtractionResult {
  extracted_team: ExtractedPokemon[] | null;
  extracted_tactic: ExtractedTactic | null;
}

// ── Markdown Helpers ─────────────────────────────────────────────────────────

function parseBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-black">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMarkdown(content: string) {
  if (!content) return null;
  const lines = content.split('\n');
  return lines.map((line, idx) => {
    const text = line.trim();
    if (!text) return <div key={idx} className="h-2" />;
    if (text.startsWith('### ')) return <h4 key={idx} className="text-sm font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(4)}</h4>;
    if (text.startsWith('## '))  return <h3 key={idx} className="text-base font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(3)}</h3>;
    if (text.startsWith('# '))   return <h2 key={idx} className="text-lg font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(2)}</h2>;
    if (text.startsWith('- ') || text.startsWith('* ')) {
      return <li key={idx} className="list-disc ml-5 text-zinc-300 mb-1 leading-relaxed text-xs font-semibold">{parseBoldText(text.slice(2))}</li>;
    }
    return <p key={idx} className="text-xs font-semibold text-zinc-300 leading-relaxed mb-2">{parseBoldText(text)}</p>;
  });
}

// ── SP Bar ───────────────────────────────────────────────────────────────────

function SpBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 32) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-black text-zinc-500 uppercase w-7 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-black w-4 text-right ${value > 0 ? "text-red-400" : "text-zinc-700"}`}>{value}</span>
    </div>
  );
}

// ── Extraction Modal ─────────────────────────────────────────────────────────

function ExtractionModal({
  result,
  onClose,
  onSaveTeam,
  onSaveTactic,
}: {
  result: ExtractionResult;
  onClose: () => void;
  onSaveTeam: (team: ExtractedPokemon[]) => Promise<void>;
  onSaveTactic: (tactic: ExtractedTactic) => Promise<void>;
}) {
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [isSavingTactic, setIsSavingTactic] = useState(false);
  const [teamSaved, setTeamSaved] = useState(false);
  const [tacticSaved, setTacticSaved] = useState(false);

  const handleSaveTeam = async () => {
    if (!result.extracted_team) return;
    setIsSavingTeam(true);
    try {
      await onSaveTeam(result.extracted_team);
      setTeamSaved(true);
    } finally {
      setIsSavingTeam(false);
    }
  };

  const handleSaveTactic = async () => {
    if (!result.extracted_tactic) return;
    setIsSavingTactic(true);
    try {
      await onSaveTactic(result.extracted_tactic);
      setTacticSaved(true);
    } finally {
      setIsSavingTactic(false);
    }
  };

  const hasTeam = result.extracted_team && result.extracted_team.length > 0;
  const hasTactic = !!result.extracted_tactic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/60 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Extraction Report</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Insights harvested from your coaching session</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-white transition-colors text-xl font-black px-2"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── Section A: Reforged Lineup ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
              <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Section A — Reforged Lineup</h3>
              {hasTeam && (
                <span className="ml-auto px-2 py-0.5 bg-green-950/40 border border-green-800/50 text-green-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
                  {result.extracted_team!.length} Pokémon Extracted
                </span>
              )}
            </div>

            {hasTeam ? (
              <>
                <p className="text-[10px] text-zinc-400 font-semibold">
                  The coach recommended the following roster modifications during your session. Review and save as a new roster.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.extracted_team!.map((p, i) => (
                    <div key={i} className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5 space-y-2.5 hover:border-zinc-700 transition-colors">
                      <div className="flex items-start justify-between border-b border-zinc-800 pb-2.5">
                        <div className="flex-1 pr-1 truncate">
                          <h4 className="text-sm font-black text-white uppercase truncate">{p.name}</h4>
                          <p className="text-[9px] text-zinc-400 font-bold uppercase mt-0.5 font-mono truncate">@ {p.item || "No Item"}</p>
                        </div>
                        <img
                          src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`}
                          alt={p.name}
                          className="w-9 h-9 object-contain drop-shadow-md"
                          onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                        />
                      </div>
                      <div className="text-[9px] text-zinc-400 font-mono space-y-0.5 uppercase">
                        <p><span className="text-zinc-600">Ability:</span> <span className="text-zinc-200 font-black">{p.ability || "—"}</span></p>
                        <p><span className="text-zinc-600">Nature:</span>  <span className="text-zinc-200 font-black">{p.nature || "—"}</span></p>
                      </div>
                      <div className="space-y-1">
                        <SpBar label="HP"  value={p.sp.hp}  />
                        <SpBar label="ATK" value={p.sp.atk} />
                        <SpBar label="DEF" value={p.sp.def} />
                        <SpBar label="SPA" value={p.sp.spa} />
                        <SpBar label="SPD" value={p.sp.spd} />
                        <SpBar label="SPE" value={p.sp.spe} />
                      </div>
                      <div className="grid grid-cols-2 gap-1 pt-0.5">
                        {p.moves.map((m, mIdx) => (
                          <div key={mIdx} className="bg-black/30 border border-zinc-900 rounded-lg px-2 py-1 text-[8px] font-black uppercase text-zinc-400 truncate" title={m}>{m}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveTeam}
                  disabled={isSavingTeam || teamSaved}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 border ${
                    teamSaved
                      ? "bg-green-900/40 border-green-700 text-green-400 cursor-default"
                      : "bg-red-700 hover:bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {isSavingTeam ? "Saving..." : teamSaved ? "✓ Saved as New Roster" : "Save as New Roster →"}
                </button>
              </>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No team modifications were discussed in this session.</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-800/60" />

          {/* ── Section B: Matchup Strategy ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-3">
              <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">Section B — Matchup Strategy</h3>
              {hasTactic && (
                <span className="ml-auto px-2 py-0.5 bg-blue-950/40 border border-blue-800/50 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg">
                  Tactic Found
                </span>
              )}
            </div>

            {hasTactic ? (
              <>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <h4 className="text-base font-black text-white uppercase tracking-wide">{result.extracted_tactic!.title}</h4>
                    <p className="text-xs text-zinc-400 font-semibold mt-1.5 leading-relaxed">{result.extracted_tactic!.matchup_summary}</p>
                  </div>

                  {result.extracted_tactic!.primary_win_condition && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-black/30 border border-zinc-900 rounded-xl p-3">
                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Core Strategy</p>
                        <p className="text-xs text-zinc-300 font-semibold leading-relaxed">{result.extracted_tactic!.primary_win_condition.core_strategy}</p>
                      </div>
                      <div className="bg-black/30 border border-zinc-900 rounded-xl p-3">
                        <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Lead Pairing</p>
                        <p className="text-xs text-zinc-300 font-semibold leading-relaxed">{result.extracted_tactic!.primary_win_condition.lead_pairing}</p>
                      </div>
                    </div>
                  )}

                  {result.extracted_tactic!.turn_by_turn && result.extracted_tactic!.turn_by_turn.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Turn-by-Turn</p>
                      {result.extracted_tactic!.turn_by_turn.map((t) => (
                        <div key={t.turn_number} className="bg-black/20 border border-zinc-900 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-red-950/40 border border-red-900/40 text-red-400 text-[9px] font-black uppercase rounded-md">Turn {t.turn_number}</span>
                          </div>
                          <ul className="space-y-0.5">
                            {t.player_actions.map((a, ai) => (
                              <li key={ai} className="text-[10px] text-zinc-300 font-semibold flex items-start gap-1.5">
                                <span className="text-red-600 mt-0.5">▸</span>{a}
                              </li>
                            ))}
                          </ul>
                          <p className="text-[9px] text-zinc-500 font-semibold italic">{t.expected_board_state}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSaveTactic}
                  disabled={isSavingTactic || tacticSaved}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 border ${
                    tacticSaved
                      ? "bg-green-900/40 border-green-700 text-green-400 cursor-default"
                      : "bg-zinc-800 hover:bg-zinc-700 border-zinc-600 text-white shadow-[0_0_20px_rgba(255,255,255,0.03)] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {isSavingTactic ? "Saving..." : tacticSaved ? "✓ Saved to Playbook Library" : "Save to Playbook Library →"}
                </button>
              </>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">No specific matchup strategy was discussed in this session.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RosterDossier({ session }: { session?: any }) {
  const [pasteInput, setPasteInput]     = useState("");
  const [team, setTeam]                 = useState<ParsedPokemon[]>([]);
  const [messages, setMessages]         = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [isChatting, setIsChatting]     = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);

  const isClosedSheet = team.length > 0 && team.every(p => {
    const totalSp = p.sp.hp + p.sp.atk + p.sp.def + p.sp.spa + p.sp.spd + p.sp.spe;
    return totalSp === 0;
  });

  const handleImport = () => {
    if (!pasteInput.trim()) return;
    try {
      const parsed = parsePokePaste(pasteInput);
      if (parsed.length === 0) { alert("Could not parse any Pokemon. Please check the paste format."); return; }
      setTeam(parsed);
      setPasteInput("");
      setMessages([]);
    } catch (e) {
      console.error(e);
      alert("Parsing failed. Check your input formatting.");
    }
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
          const optimized = data.optimized_team.find((op: any) => op.id === p.id || op.name === p.name);
          if (optimized && optimized.sp) {
            const newSp = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...optimized.sp };
            let total = 0;
            const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
            STATS.forEach(s => { newSp[s] = Math.max(0, Math.min(Number(newSp[s]) || 0, 32)); total += newSp[s]; });
            if (total > 66) {
              let diff = total - 66;
              while (diff > 0) {
                const highestStat = STATS.reduce((max, s) => newSp[s] > newSp[max] ? s : max, "hp" as const);
                newSp[highestStat] -= 1; diff--;
              }
            }
            return { ...p, sp: newSp };
          }
          return p;
        }));
      }
    } catch (e) { console.error(e); alert("Failed to calculate optimal 66-SP spreads."); }
    finally { setIsOptimizing(false); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatting || team.length === 0) return;
    const userMsg = { role: "user" as const, content: chatInput };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput("");
    setIsChatting(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, action: "dossier_chat", messages: updatedMessages, dossier: null })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.message) setMessages(prev => [...prev, { role: "assistant" as const, content: data.message }]);
    } catch (e) { console.error(e); alert("Failed to get VGC Coach response."); }
    finally { setIsChatting(false); }
  };

  const handleExtract = async () => {
    if (messages.length === 0) { alert("You need at least one coaching exchange before extracting insights."); return; }
    setIsExtracting(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: team.length > 0 ? team : null, action: "extract_dossier", messages })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExtractionResult(data as ExtractionResult);
    } catch (e) {
      console.error("[Dossier Extract] Failed:", e);
      alert("Failed to extract insights. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Save Handlers ─────────────────────────────────────────────────────────

  const handleSaveExtractedTeam = async (extractedTeam: ExtractedPokemon[]) => {
    const teamName = prompt("Name this reforged roster (e.g. Golurk TR Core v2):");
    if (!teamName?.trim()) return;
    try {
      if (!session?.user) {
        // LocalStorage fallback
        const localPayload = {
          id: Math.random().toString(36).substring(2, 11),
          team_name: teamName.trim(),
          team_data: extractedTeam,
          assessment_data: { source: "dossier_extraction", chat_length: messages.length },
          created_at: new Date().toISOString()
        };
        const currentTeams = JSON.parse(localStorage.getItem("poke_saved_teams") || "[]");
        currentTeams.unshift(localPayload);
        localStorage.setItem("poke_saved_teams", JSON.stringify(currentTeams));
        alert(`Roster "${teamName}" saved successfully (Local Save)!`);
        return;
      }

      if (!supabase) {
        alert("Supabase client is null. Cannot complete cloud save.");
        return;
      }

      const { error } = await supabase.from("saved_teams").insert([{
        team_name: teamName.trim(),
        team_data: extractedTeam,
        assessment_data: { source: "dossier_extraction", chat_length: messages.length },
        user_id: session.user.id
      }]);
      if (error) { console.error("[Supabase] saved_teams INSERT error:", error); alert("Save failed: " + error.message); }
      else { alert(`Roster "${teamName}" saved successfully!`); }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert("Save failed: " + msg);
    }
  };

  const handleSaveExtractedTactic = async (tactic: ExtractedTactic) => {
    try {
      if (!session?.user) {
        // LocalStorage fallback
        const localPayload = {
          id: Math.random().toString(36).substring(2, 11),
          title: tactic.title,
          team: team,
          playbook: tactic,
          created_at: new Date().toISOString()
        };
        const currentStrats = JSON.parse(localStorage.getItem("poke_saved_strategies") || "[]");
        currentStrats.unshift(localPayload);
        localStorage.setItem("poke_saved_strategies", JSON.stringify(currentStrats));
        alert(`Strategy "${tactic.title}" saved to Playbook Library (Local Save)!`);
        return;
      }

      if (!supabase) {
        alert("Supabase client is null. Cannot complete cloud save.");
        return;
      }

      const { error } = await supabase.from("saved_strategies").insert([{
        title: tactic.title,
        team: team,
        playbook: tactic,
        user_id: session.user.id
      }]);
      if (error) { console.error("[Supabase] saved_strategies INSERT error:", error); alert("Save failed: " + error.message); }
      else { alert(`Strategy "${tactic.title}" saved to Playbook Library!`); }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert("Save failed: " + msg);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-20 space-y-8 animate-fade-in relative z-10">

      {/* Extraction Modal */}
      {extractionResult && (
        <ExtractionModal
          result={extractionResult}
          onClose={() => setExtractionResult(null)}
          onSaveTeam={handleSaveExtractedTeam}
          onSaveTactic={handleSaveExtractedTactic}
        />
      )}

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tight text-white uppercase">Roster Study Dossier</h2>
        <p className="text-zinc-400 text-sm font-medium">Import any meta team sheet to visually inspect their 66-SP splits and debate tactics with the sparring coach.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* Left Side: Setup & Cards */}
        <div className="lg:col-span-2 space-y-6">

          {/* Universal Import Box */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="text-xs font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Universal Team Sheets Importer</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Paste standard Showdown/PokéPaste format or Limitless Closed Team Sheets.</p>
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="Paste team sheet export here..."
              className="w-full h-36 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all resize-none shadow-inner leading-relaxed"
            />
            <button
              onClick={handleImport}
              disabled={!pasteInput.trim()}
              className="w-full md:w-auto px-6 py-3 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white uppercase tracking-widest shadow-[0_0_15px_rgba(220,38,38,0.15)] flex items-center justify-center gap-2"
            >
              Import Team Roster
            </button>
          </div>

          {/* Roster Display */}
          {team.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest border-l-4 border-red-650 pl-3">Imported Roster ({team.length}/6)</h3>
              </div>

              {isClosedSheet && (
                <div className="bg-red-950/20 border border-red-900/30 text-red-400 p-4 rounded-xl text-xs font-bold flex flex-col sm:flex-row justify-between items-center gap-3">
                  <span>⚠️ Limitless Closed Team Sheet parsed (no EV spreads).</span>
                  <button
                    onClick={handleOptimize}
                    disabled={isOptimizing}
                    className="px-4 py-2 rounded-lg font-black text-[10px] bg-red-700 hover:bg-red-600 text-white border border-red-500 uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {isOptimizing ? "Optimizing..." : "Optimize 66-SP Spreads"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.map((p, i) => (
                  <div key={i} className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 flex flex-col space-y-3 relative group transition-all duration-300 hover:scale-[1.01] hover:border-red-900/40 shadow-xl">
                    <div className="flex items-start justify-between border-b border-zinc-850 pb-3">
                      <div className="flex-1 pr-1 truncate">
                        <h3 className="text-base font-black text-white uppercase truncate">{p.name}</h3>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase mt-1 font-mono truncate">@ {p.item || "No Item"}</p>
                      </div>
                      <img
                        src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`}
                        alt={p.name}
                        className="w-10 h-10 object-contain drop-shadow-md"
                        onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-350 space-y-1 font-mono uppercase tracking-wider">
                      <p><span className="font-bold text-zinc-500">Ability:</span> <span className="text-zinc-200 font-extrabold">{p.ability || "None"}</span></p>
                      <p><span className="font-bold text-zinc-500">Nature:</span> <span className="text-zinc-200 font-extrabold">{p.nature || "Neutral"}</span></p>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-zinc-900">
                      <h4 className="text-[8px] font-black uppercase text-red-500 mb-2 font-mono">66-SP Stats</h4>
                      <div className="grid grid-cols-6 gap-1 text-center text-[10px] font-black font-mono">
                        <div className={p.sp.hp  > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">HP</span>{p.sp.hp}</div>
                        <div className={p.sp.atk > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">ATK</span>{p.sp.atk}</div>
                        <div className={p.sp.def > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">DEF</span>{p.sp.def}</div>
                        <div className={p.sp.spa > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPA</span>{p.sp.spa}</div>
                        <div className={p.sp.spd > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPD</span>{p.sp.spd}</div>
                        <div className={p.sp.spe > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPE</span>{p.sp.spe}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      {p.moves.map((m, mIdx) => (
                        <div key={mIdx} className="bg-black/20 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase text-zinc-400 truncate" title={m}>{m}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Coach Sparring Console */}
        <div className="lg:col-span-1 space-y-3">

          {/* Extract & Save Insights Button */}
          <button
            onClick={handleExtract}
            disabled={isExtracting || messages.length === 0}
            className="w-full py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 border flex items-center justify-center gap-2.5 group
              bg-gradient-to-r from-red-950/60 to-zinc-900/60
              hover:from-red-900/80 hover:to-zinc-800/80
              border-red-800/50 hover:border-red-600
              text-red-400 hover:text-red-300
              shadow-[0_0_20px_rgba(220,38,38,0.08)] hover:shadow-[0_0_30px_rgba(220,38,38,0.2)]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-red-950/60 disabled:hover:to-zinc-900/60 disabled:hover:border-red-800/50 disabled:hover:shadow-none"
          >
            {isExtracting ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-red-500 border-t-transparent rounded-full" />
                <span>Extracting Insights...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>Extract &amp; Save Insights</span>
                {messages.length > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 bg-red-900/40 border border-red-800/50 text-red-400 text-[8px] font-black rounded-md">
                    {messages.length} msg{messages.length !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            )}
          </button>

          {/* Sparring Console */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl h-[580px] flex flex-col overflow-hidden shadow-2xl">

            {/* Console Header */}
            <div className="p-4 border-b border-zinc-850 bg-zinc-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Tactical Sparring Console</h3>
              </div>
              <span className="px-2 py-0.5 bg-red-950/30 text-red-500 border border-red-900/40 rounded-lg text-[9px] font-black uppercase tracking-widest">VGC Coach</span>
            </div>

            {/* Scrollable Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
              {team.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-3">
                  <svg className="w-8 h-8 opacity-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">Please import a team roster to initiate tactical sparring with the coach.</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                    Roster context loaded.<br />Challenge the coach or ask about structural win conditions.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-semibold break-words whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-red-700/10 border border-red-900/30 text-zinc-200 self-end rounded-tr-none"
                        : "bg-zinc-950 border border-zinc-900 text-zinc-300 self-start rounded-tl-none"
                    }`}
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider block mb-1.5 opacity-60">
                      {msg.role === "user" ? "Challenger" : "VGC Coach"}
                    </span>
                    <div className="space-y-1.5">{renderMarkdown(msg.content)}</div>
                  </div>
                ))
              )}
              {isChatting && (
                <div className="bg-zinc-950 border border-zinc-900 text-zinc-300 self-start rounded-2xl rounded-tl-none p-3.5 max-w-[85%] flex items-center gap-2">
                  <div className="animate-pulse flex space-x-1">
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                  </div>
                  <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Coach is writing...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-zinc-850 bg-zinc-900/80 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                disabled={isChatting || team.length === 0}
                placeholder={team.length === 0 ? "Import a roster first..." : "Ask coach about pivots, checks..."}
                className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none"
              />
              <button
                onClick={handleSendChat}
                disabled={isChatting || !chatInput.trim() || team.length === 0}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 border border-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

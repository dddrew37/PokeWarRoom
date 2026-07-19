"use client";

import React, { useState, useRef, useEffect } from "react";
import { ParsedPokemon } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";
import { supabase } from "../lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
  team?: ParsedPokemon[] | null;
  strategy?: string | null;
}

interface AIBuilderProps {
  setTeam: React.Dispatch<React.SetStateAction<ParsedPokemon[]>>;
  setActiveTab: (tab: "forge" | "logger" | "saved" | "dossier" | "memory") => void;
  session?: any;
}

const QUICK_SUGGESTIONS = [
  "Build a team with Mega Sceptile as a fast physical sweeper",
  "Suggest a Trick Room core featuring Mega Audino",
  "Build a balanced Rain team around Pelipper",
  "Create an offensive Sun team featuring Mega Houndoom"
];

export default function AIBuilder({ setTeam, setActiveTab, session }: AIBuilderProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Let us build a competitive Regulation MB roster. What archetype, core, or main sweeper would you like to build around?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    const updatedMessages = [...messages, { role: "user", content: query } as Message];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "builder_chat",
          messages: updatedMessages
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.message || "I have formulated a strategy.",
          team: Array.isArray(data.team) && data.team.length === 6 ? data.team : null,
          strategy: data.strategy || null
        }
      ]);
    } catch (e) {
      console.error("[AIBuilder] Chat error:", e);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Apologies, I encountered an issue while generating the team strategy. Please verify your connection and try again."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportToForge = (proposedTeam: ParsedPokemon[]) => {
    const zeroStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    const normalized = proposedTeam.map(raw => ({
      id: raw.id ?? '',
      name: raw.name ?? '',
      item: raw.item ?? '',
      ability: raw.ability ?? '',
      nature: raw.nature ?? '',
      evs: raw.evs ? { ...zeroStats, ...raw.evs } : { ...zeroStats },
      sp:  raw.sp  ? { ...zeroStats, ...raw.sp  } : { ...zeroStats },
      moves: Array.isArray(raw.moves) ? raw.moves : [],
    }));
    setTeam(normalized);
    setActiveTab("forge");
    alert("Roster successfully imported to Team Forge!");
  };

  const handleSaveRosterDirectly = async (msgIndex: number, proposedTeam: ParsedPokemon[], strategyText: string | null) => {
    const rawName = teamNames[msgIndex] || "";
    const name = rawName.trim();
    if (!name) {
      alert("Please enter a name for the roster before saving.");
      return;
    }

    setSavingIndex(msgIndex);
    try {
      const assessmentData = strategyText ? {
        core_identity: name + " Strategy",
        red_flags: [],
        team_grades: { offense: 85, bulk: 80, speed_control: 80, synergy: 85 },
        play_by_play: null,
        turn_1_plan: strategyText
      } : null;

      const zeroStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      const normalizedTeam = proposedTeam.map(raw => ({
        id: raw.id ?? '',
        name: raw.name ?? '',
        item: raw.item ?? '',
        ability: raw.ability ?? '',
        nature: raw.nature ?? '',
        evs: raw.evs ? { ...zeroStats, ...raw.evs } : { ...zeroStats },
        sp:  raw.sp  ? { ...zeroStats, ...raw.sp  } : { ...zeroStats },
        moves: Array.isArray(raw.moves) ? raw.moves : [],
      }));

      if (!session?.user) {
        // Local fallback
        const localPayload = {
          id: Math.random().toString(36).substring(2, 11),
          team_name: name,
          team_data: normalizedTeam,
          assessment_data: assessmentData,
          created_at: new Date().toISOString()
        };
        const currentTeams = JSON.parse(localStorage.getItem("poke_saved_teams") || "[]");
        currentTeams.unshift(localPayload);
        localStorage.setItem("poke_saved_teams", JSON.stringify(currentTeams));
        alert("Roster saved successfully (Local Save)!");
        setTeamNames(prev => ({ ...prev, [msgIndex]: "" }));
        return;
      }

      if (!supabase) {
        alert("Supabase client is null. Cannot complete cloud save.");
        return;
      }

      const payload = {
        team_name: name,
        team_data: normalizedTeam,
        assessment_data: assessmentData,
        user_id: session.user.id
      };

      const { error } = await supabase.from("saved_teams").insert([payload]);
      if (error) {
        alert("Failed to save roster: " + error.message);
      } else {
        alert("Roster saved successfully to Saved Books!");
        setTeamNames(prev => ({ ...prev, [msgIndex]: "" }));
      }
    } catch (err: any) {
      console.error("[AIBuilder] Direct Save error:", err);
      alert("Failed to save roster: " + (err.message || "Unknown error"));
    } finally {
      setSavingIndex(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-[75vh] bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-red-950/10 blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-zinc-900/10 blur-3xl pointer-events-none z-0" />

      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center z-10 bg-zinc-950/80 backdrop-blur">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            AI Strategy Builder
          </h2>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
            Roster Brainstorming & Analysis Chat
          </span>
        </div>
        <button
          onClick={() => {
            if (confirm("Reset chat history?")) {
              setMessages([
                {
                  role: "assistant",
                  content: "Let us build a competitive Regulation MB roster. What archetype, core, or main sweeper would you like to build around?"
                }
              ]);
            }
          }}
          className="text-zinc-500 hover:text-red-500 font-mono text-[9px] font-black uppercase tracking-widest border border-zinc-900 bg-zinc-900/40 hover:bg-red-950/10 px-3 py-1.5 rounded-lg transition-all"
        >
          Reset Chat
        </button>
      </div>

      {/* Chat Messages scroll area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent relative z-10">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono px-1">
                {isUser ? "Operator" : "Coach Analyst"}
              </span>
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-xs font-medium leading-relaxed font-mono ${
                  isUser
                    ? "bg-red-950/20 border border-red-900/30 text-red-100"
                    : "bg-zinc-900 border border-zinc-850 text-zinc-200"
                }`}
              >
                {msg.content}
              </div>

              {/* Proposed Team Cards */}
              {!isUser && msg.team && (
                <div className="w-full mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {msg.team.map((p, i) => (
                      <div
                        key={i}
                        className="bg-zinc-900/60 border border-zinc-850 rounded-2xl p-4 flex flex-col space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                          <div className="min-w-0 flex-1">
                            <span className="block text-xs font-black text-white uppercase tracking-tight truncate">
                              {p.name}
                            </span>
                            <span className="block text-[8px] font-bold text-zinc-500 uppercase tracking-wider font-mono truncate mt-0.5">
                              {p.item || "No Item"}
                            </span>
                          </div>
                          <img
                            src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`}
                            alt={p.name}
                            className="w-10 h-10 object-contain drop-shadow"
                            onError={(e) => {
                              e.currentTarget.src = POKEBALL_FALLBACK;
                            }}
                          />
                        </div>

                        <div className="text-[9px] text-zinc-400 space-y-0.5 font-mono uppercase tracking-wider">
                          <p>
                            <span className="text-zinc-650 font-bold mr-1">Ability:</span>
                            {p.ability || "None"}
                          </p>
                          <p>
                            <span className="text-zinc-650 font-bold mr-1">Nature:</span>
                            {p.nature || "Neutral"}
                          </p>
                        </div>

                        {/* SP Stats display */}
                        <div className="bg-black/40 rounded-xl p-2.5 border border-zinc-850">
                          <div className="grid grid-cols-6 gap-1 text-center text-[9px] font-black font-mono">
                            <div className={p.sp.hp > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">HP</span>
                              {p.sp.hp}
                            </div>
                            <div className={p.sp.atk > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">ATK</span>
                              {p.sp.atk}
                            </div>
                            <div className={p.sp.def > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">DEF</span>
                              {p.sp.def}
                            </div>
                            <div className={p.sp.spa > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">SPA</span>
                              {p.sp.spa}
                            </div>
                            <div className={p.sp.spd > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">SPD</span>
                              {p.sp.spd}
                            </div>
                            <div className={p.sp.spe > 0 ? "text-red-500" : "text-zinc-700"}>
                              <span className="block text-[6px] font-bold text-zinc-500 uppercase mb-0.5">SPE</span>
                              {p.sp.spe}
                            </div>
                          </div>
                        </div>

                        {/* Moves */}
                        <div className="grid grid-cols-2 gap-1 text-[8px] font-mono">
                          {p.moves.slice(0, 4).map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="bg-black/30 border border-zinc-850 text-zinc-400 rounded-lg py-1 px-1.5 truncate text-center uppercase font-black"
                            >
                              {m}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions for proposed team */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900 border border-zinc-850 rounded-2xl p-4 mt-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Roster Save Name (e.g. Mega Sceptile hyper offense)"
                        value={teamNames[idx] || ""}
                        onChange={(e) => setTeamNames(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="flex-1 bg-zinc-950 border border-zinc-800 text-xs text-white rounded-lg py-1.5 px-3 focus:outline-none focus:border-red-500 font-mono placeholder-zinc-600 sm:w-80"
                      />
                      <button
                        onClick={() => handleSaveRosterDirectly(idx, msg.team!, msg.strategy ?? null)}
                        disabled={savingIndex === idx}
                        className="bg-red-950/20 border border-red-900/40 text-red-500 font-black uppercase text-[10px] tracking-wider rounded-lg px-4 py-1.5 transition-all hover:bg-red-500 hover:text-white shrink-0 font-mono"
                      >
                        {savingIndex === idx ? "Saving..." : "Save Roster"}
                      </button>
                    </div>

                    <button
                      onClick={() => handleImportToForge(msg.team!)}
                      className="bg-zinc-950 border border-zinc-800 hover:border-red-900/40 text-zinc-400 hover:text-red-500 font-black uppercase text-[10px] tracking-wider rounded-lg px-5 py-2 transition-all font-mono w-full sm:w-auto"
                    >
                      Import to Team Forge
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="flex flex-col items-start space-y-1.5 animate-pulse">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest font-mono px-1">
              Coach Analyst
            </span>
            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl px-5 py-3.5 space-y-2 w-64">
              <div className="h-2 bg-zinc-800 rounded w-5/6" />
              <div className="h-2 bg-zinc-800 rounded w-3/4" />
              <div className="h-2 bg-zinc-800 rounded w-4/5" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions panel */}
      {messages.length === 1 && !isLoading && (
        <div className="px-6 py-3 border-t border-zinc-900 bg-zinc-950/50 z-10">
          <span className="block text-[8px] font-black text-zinc-650 uppercase tracking-widest font-mono mb-2">
            Suggested Teambuilding Prompts
          </span>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput("");
                  handleSendMessage(s);
                }}
                className="bg-zinc-900/60 hover:bg-red-950/10 border border-zinc-850 hover:border-red-900/30 text-zinc-400 hover:text-red-400 font-mono text-[9px] font-bold px-3 py-1.5 rounded-xl transition-all select-none"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-zinc-900 bg-zinc-950 z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-900 rounded-2xl p-2"
        >
          <input
            type="text"
            placeholder="Build a hyper-offensive team featuring Mega Altaria..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none px-3 font-mono leading-relaxed"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-red-650 hover:bg-red-550 disabled:bg-zinc-900 border border-red-750 disabled:border-zinc-800 text-white disabled:text-zinc-600 font-black uppercase text-[10px] tracking-widest rounded-xl px-5 py-2.5 transition-all font-mono"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

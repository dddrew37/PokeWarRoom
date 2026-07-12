"use client";

import { useState } from "react";
import { ParsedPokemon, parsePokePaste } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

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

    // Headers
    if (text.startsWith('### ')) {
      return <h4 key={idx} className="text-sm font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(4)}</h4>;
    }
    if (text.startsWith('## ')) {
      return <h3 key={idx} className="text-base font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(3)}</h3>;
    }
    if (text.startsWith('# ')) {
      return <h2 key={idx} className="text-lg font-black text-red-500 uppercase tracking-widest mt-4 mb-2">{text.slice(2)}</h2>;
    }

    // Unordered List Items
    if (text.startsWith('- ') || text.startsWith('* ')) {
      const bulletContent = parseBoldText(text.slice(2));
      return (
        <li key={idx} className="list-disc ml-5 text-zinc-300 mb-1 leading-relaxed text-xs font-semibold">
          {bulletContent}
        </li>
      );
    }

    // Parse standard line
    return (
      <p key={idx} className="text-xs font-semibold text-zinc-300 leading-relaxed mb-2">
        {parseBoldText(text)}
      </p>
    );
  });
}

export default function RosterDossier() {
  const [pasteInput, setPasteInput] = useState("");
  const [team, setTeam] = useState<ParsedPokemon[]>([]);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Checks if the imported team has 0 SP spreads
  const isClosedSheet = team.length > 0 && team.every(p => {
    const totalSp = p.sp.hp + p.sp.atk + p.sp.def + p.sp.spa + p.sp.spd + p.sp.spe;
    return totalSp === 0;
  });

  const handleImport = () => {
    if (!pasteInput.trim()) return;
    try {
      const parsed = parsePokePaste(pasteInput);
      if (parsed.length === 0) {
        alert("Could not parse any Pokemon. Please check the paste format.");
        return;
      }
      setTeam(parsed);
      setPasteInput(""); // Clears import box after successful import
      setMessages([]); // Reset chat history to prevent contextual cross-contamination
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
             STATS.forEach(s => {
               newSp[s] = Math.max(0, Math.min(Number(newSp[s]) || 0, 32));
               total += newSp[s];
             });
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
      alert("Failed to calculate optimal 66-SP spreads.");
    } finally {
      setIsOptimizing(false);
    }
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
        body: JSON.stringify({
          team,
          action: "dossier_chat",
          messages: updatedMessages,
          dossier: null
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.message) {
        setMessages(prev => [...prev, { role: "assistant" as const, content: data.message }]);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to get VGC Coach response.");
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-20 space-y-8 animate-fade-in relative z-10">
      
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
                        <div className={p.sp.hp > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">HP</span>{p.sp.hp}</div>
                        <div className={p.sp.atk > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">ATK</span>{p.sp.atk}</div>
                        <div className={p.sp.def > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">DEF</span>{p.sp.def}</div>
                        <div className={p.sp.spa > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPA</span>{p.sp.spa}</div>
                        <div className={p.sp.spd > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPD</span>{p.sp.spd}</div>
                        <div className={p.sp.spe > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-0.5">SPE</span>{p.sp.spe}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-1">
                      {p.moves.map((m, mIdx) => (
                        <div key={mIdx} className="bg-black/20 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase text-zinc-400 truncate" title={m}>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Coach Sparring Console */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-3xl h-[600px] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Console Header */}
            <div className="p-4 border-b border-zinc-850 bg-zinc-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Tactical Sparring Console</h3>
              </div>
              <span className="px-2 py-0.5 bg-red-950/30 text-red-500 border border-red-900/40 rounded-lg text-[9px] font-black uppercase tracking-widest">
                VGC Coach
              </span>
            </div>

            {/* Scrollable Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
              {team.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-3">
                  <svg className="w-8 h-8 opacity-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                    Please import a team roster to initiate tactical sparring with the coach.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500 gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed max-w-xs">
                    Roster context loaded.<br/>
                    Challenge the coach or ask about structural win conditions.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-semibold ${
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
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full"></div>
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

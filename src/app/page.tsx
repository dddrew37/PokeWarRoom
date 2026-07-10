"use client";

import { useState } from "react";
import TeamForge from "@/components/TeamForge";
import TeamPreviewLogger from "@/components/TeamPreviewLogger";
import SavedStrategies from "@/components/SavedStrategies";
import { ParsedPokemon } from "@/lib/parser";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"forge" | "logger" | "saved">("forge");
  const [teamState, setTeamState] = useState<ParsedPokemon[]>([]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center pb-20 px-4 relative overflow-hidden selection:bg-red-500/30">
      {/* Premium ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-4xl h-[400px] bg-red-700/5 rounded-full blur-3xl pointer-events-none z-0" />
      
      {/* Decorative technical lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />
      
      {/* Top Status Bar */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center py-6 mb-12 border-b border-zinc-900 z-10 relative">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-widest bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              PokeWarRoom
            </h1>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Tactical Coaching Terminal</span>
        </div>
        
        <div className="flex items-center gap-6 mt-4 md:mt-0 font-mono text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
          <div>
            <span className="text-zinc-600 mr-1.5 font-semibold">SYS STATUS:</span>
            <span className="text-red-500 font-black">OPERATIONAL</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-zinc-600 mr-1.5 font-semibold">REGULATION:</span>
            <span className="text-zinc-300 font-black">M-B</span>
          </div>
          <div>
            <span className="text-zinc-600 mr-1.5 font-semibold">ENGINE:</span>
            <span className="text-zinc-300 font-black">66-SP V2</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="w-full max-w-md flex bg-black/40 backdrop-blur-md rounded-2xl p-1.5 mb-10 border border-zinc-850 shadow-2xl relative z-10">
        <button
          onClick={() => setActiveTab("forge")}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "forge" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Team Forge
        </button>
        <button
          onClick={() => setActiveTab("logger")}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "logger" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Live Logger
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "saved" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Saved Books
        </button>
      </div>

      <div className="w-full relative z-10">
        {activeTab === "forge" && <TeamForge team={teamState} setTeam={setTeamState} />}
        {activeTab === "logger" && <TeamPreviewLogger playerTeam={teamState} onGoToForge={() => setActiveTab("forge")} />}
        {activeTab === "saved" && <SavedStrategies />}
      </div>
    </main>
  );
}

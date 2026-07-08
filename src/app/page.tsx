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
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center pt-8 pb-20 px-4 selection:bg-blue-500/30">
      <div className="w-full max-w-md flex bg-zinc-900 rounded-xl p-1 mb-8 border border-zinc-800 shadow-inner">
        <button
          onClick={() => setActiveTab("forge")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "forge" 
              ? "bg-zinc-800 text-white shadow-sm border border-zinc-700" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Team Forge
        </button>
        <button
          onClick={() => setActiveTab("logger")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "logger" 
              ? "bg-zinc-800 text-white shadow-sm border border-zinc-700" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Live Logger
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            activeTab === "saved" 
              ? "bg-zinc-800 text-white shadow-sm border border-zinc-700" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Saved Books
        </button>
      </div>

      <div className="w-full">
        {activeTab === "forge" && <TeamForge team={teamState} setTeam={setTeamState} />}
        {activeTab === "logger" && <TeamPreviewLogger playerTeam={teamState} onGoToForge={() => setActiveTab("forge")} />}
        {activeTab === "saved" && <SavedStrategies />}
      </div>
    </main>
  );
}

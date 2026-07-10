"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import LivePlaybook from "./LivePlaybook";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

export default function SavedStrategies() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSaved = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("saved_strategies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[Supabase] saved_strategies SELECT error:", error);
        alert("Failed to load saved strategies: " + error.message);
      }
      if (data) setStrategies(data);
    } catch (err: unknown) {
      console.error("[Supabase] saved_strategies SELECT exception:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to load saved strategies: " + message);
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
        <p className="text-zinc-400 text-sm font-medium">Your saved tactical flowcharts</p>
        <button
          onClick={fetchSaved}
          disabled={isRefreshing}
          className="mt-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!supabase && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm font-bold">Supabase not configured. Set environment variables to enable saved strategies.</p>
        </div>
      )}

      {loading && supabase && (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-4 border-red-500 border-t-transparent"></div>
        </div>
      )}

      {!loading && strategies.length === 0 && supabase && (
        <div className="bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">No Saved Books</p>
        </div>
      )}

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
                  onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} // Fallback if missing
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { ParsedPokemon } from "../lib/parser";
import metaData from "../data/meta_data.json";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

export default function SpeedVisualizer({ team }: { team: ParsedPokemon[] }) {
  const [tailwind, setTailwind] = useState(false);
  const [icyWind, setIcyWind] = useState(false);
  const [paralyzed, setParalyzed] = useState(false);
  const [whiteHerb, setWhiteHerb] = useState(false);

  // Normalize name to match DB (like in parser)
  const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const getCalculatedSpeed = (pokemon: ParsedPokemon) => {
    const dbMatch = metaData.pokemon.find((p: any) => normalize(p.name) === normalize(pokemon.name));
    const baseSpeed = dbMatch ? dbMatch.baseStats.spe : 50; // Fallback to 50
    
    const spSpeed = pokemon.sp ? pokemon.sp.spe : 0;
    
    // Base formula
    let finalSpeed = baseSpeed + (spSpeed / 2) + 20;
    
    let multipliers = [];
    
    // Field states
    if (tailwind) {
      finalSpeed *= 2;
      multipliers.push("Tailwind (x2)");
    }
    if (icyWind) {
      finalSpeed *= 0.66;
      multipliers.push("Icy Wind (x0.66)");
    }
    if (paralyzed) {
      finalSpeed *= 0.5;
      multipliers.push("Paralyzed (x0.5)");
    }

    // Items and Abilities
    const item = (pokemon.item || "").toLowerCase();
    const ability = (pokemon.ability || "").toLowerCase();

    if (item.includes("choice scarf")) {
      finalSpeed *= 1.5;
      multipliers.push("Choice Scarf (x1.5)");
    }
    
    if (ability === "unburden" && whiteHerb) {
      finalSpeed *= 2;
      multipliers.push("Unburden (x2)");
    }

    return {
      ...pokemon,
      finalSpeed: Math.floor(finalSpeed),
      multipliers
    };
  };

  const calculatedTeam = team.map(getCalculatedSpeed).sort((a, b) => b.finalSpeed - a.finalSpeed);

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-inner">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-black text-cyan-400">Speed Tiers</h3>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Active Turn Order</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500/50 transition-colors">
            <input type="checkbox" checked={tailwind} onChange={(e) => setTailwind(e.target.checked)} className="accent-cyan-500" />
            Tailwind Active
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500/50 transition-colors">
            <input type="checkbox" checked={icyWind} onChange={(e) => setIcyWind(e.target.checked)} className="accent-cyan-500" />
            Icy Wind (-1)
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500/50 transition-colors">
            <input type="checkbox" checked={paralyzed} onChange={(e) => setParalyzed(e.target.checked)} className="accent-cyan-500" />
            Paralyzed
          </label>
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-cyan-500/50 transition-colors">
            <input type="checkbox" checked={whiteHerb} onChange={(e) => setWhiteHerb(e.target.checked)} className="accent-cyan-500" />
            Herb Consumed
          </label>
        </div>
      </div>

      <div className="space-y-3">
        {calculatedTeam.length === 0 ? (
          <p className="text-zinc-500 text-center py-4 font-bold text-sm uppercase tracking-widest">No Pokémon in roster.</p>
        ) : (
          calculatedTeam.map((p, i) => (
            <div key={i} className="flex items-center gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <div className="w-12 h-12 flex-shrink-0 bg-zinc-900 rounded-full border border-zinc-700 overflow-hidden flex justify-center items-center">
                <img 
                  src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} 
                  alt={p.name}
                  className="w-10 h-10 object-contain drop-shadow-md"
                  onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }}
                />
              </div>
              <div className="flex flex-col flex-grow">
                <span className="font-black text-white text-lg leading-tight">{p.name}</span>
                {p.multipliers.length > 0 && (
                  <span className="text-xs text-cyan-400 font-bold">{p.multipliers.join(", ")}</span>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-2xl font-black text-cyan-400">{p.finalSpeed}</div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Speed</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

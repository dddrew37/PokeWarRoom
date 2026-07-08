import { ParsedPokemon } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

export default function RosterVisualizer({ team, onEdit }: { team: ParsedPokemon[], onEdit?: (index: number) => void }) {
  if (team.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10 w-full max-w-6xl mx-auto pb-10">
      {team.map((p, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col space-y-4 shadow-xl relative group">
          {onEdit && (
            <button 
              onClick={() => onEdit(i)}
              className="absolute top-4 right-4 p-2 bg-zinc-800 hover:bg-blue-600 rounded-lg text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 shadow-md border border-zinc-700/50 focus:opacity-100"
              title="Edit Pokémon"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          <div className="flex items-start justify-between border-b border-zinc-800/60 pb-4 pr-8">
            <div className="flex-1 pr-2">
              <h3 className="text-2xl font-black text-white tracking-tight leading-tight">{p.name}</h3>
              <p className="text-sm text-zinc-400 font-medium mt-1">@ {p.item || "No Item"}</p>
            </div>
            <img src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} alt={p.name} className="w-16 h-16 object-contain drop-shadow-lg" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
          </div>

          <div className="text-sm text-zinc-300 space-y-1">
            <p><span className="font-bold text-zinc-500 uppercase text-xs tracking-widest mr-2">Ability</span> {p.ability || "None"}</p>
            <p><span className="font-bold text-zinc-500 uppercase text-xs tracking-widest mr-2">Nature</span> {p.nature || "Neutral"}</p>
          </div>

          <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800/80 shadow-inner">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-3">66-SP Distribution</h4>
            <div className="grid grid-cols-6 gap-2 text-center text-sm font-black">
              <div className={p.sp.hp > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">HP</span>{p.sp.hp}</div>
              <div className={p.sp.atk > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">ATK</span>{p.sp.atk}</div>
              <div className={p.sp.def > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">DEF</span>{p.sp.def}</div>
              <div className={p.sp.spa > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">SPA</span>{p.sp.spa}</div>
              <div className={p.sp.spd > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">SPD</span>{p.sp.spd}</div>
              <div className={p.sp.spe > 0 ? "text-white" : "text-zinc-700"}><span className="block text-[9px] font-bold text-zinc-500 uppercase">SPE</span>{p.sp.spe}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {p.moves.map((m, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-lg px-3 py-2 text-xs font-bold text-zinc-200 border border-zinc-700/30 truncate">
                {m}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

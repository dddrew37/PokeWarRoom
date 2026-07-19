import { ParsedPokemon } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";

export default function RosterVisualizer({ team, onEdit }: { team: ParsedPokemon[], onEdit?: (index: number) => void }) {
  if (team.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10 w-full max-w-6xl mx-auto pb-10">
      {team.map((p, i) => (
        <div key={i} className="bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-850 hover:border-red-900/40 rounded-3xl p-6 flex flex-col space-y-4 shadow-2xl relative group hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(220,38,38,0.05)] transition-all duration-300">
          {onEdit && (
            <button 
              onClick={() => onEdit(i)}
              className="absolute top-4 right-4 p-2 bg-zinc-800/80 hover:bg-red-700 rounded-lg text-zinc-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-md border border-zinc-700/50 focus:opacity-100"
              title="Edit Pokémon"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          <div className="flex items-start justify-between border-b border-zinc-850 pb-4 pr-8">
            <div className="flex-1 pr-2">
              <h3 className="text-2xl font-black text-white tracking-tight leading-tight uppercase">{p.name}</h3>
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-1.5 font-mono">@ {p.item || "No Item"}</p>
            </div>
            <img src={`https://play.pokemonshowdown.com/sprites/gen5/${p.id}.png`} alt={p.name} className="w-16 h-16 object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
          </div>

          <div className="text-xs text-zinc-300 space-y-1.5 font-mono uppercase tracking-wider">
            <p><span className="font-bold text-zinc-500 mr-2">Ability:</span> <span className="text-zinc-200 font-extrabold">{p.ability || "None"}</span></p>
            <p><span className="font-bold text-zinc-500 mr-2">Nature:</span> <span className="text-zinc-200 font-extrabold">{p.nature || "Neutral"}</span></p>
          </div>

          <div className="bg-black/60 rounded-2xl p-4 border border-zinc-850 shadow-inner">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-3 font-mono">SP Distribution</h4>
            <div className="grid grid-cols-6 gap-2 text-center text-xs font-black font-mono">
              <div className={p.sp.hp > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">HP</span>{p.sp.hp}</div>
              <div className={p.sp.atk > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">ATK</span>{p.sp.atk}</div>
              <div className={p.sp.def > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">DEF</span>{p.sp.def}</div>
              <div className={p.sp.spa > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">SPA</span>{p.sp.spa}</div>
              <div className={p.sp.spd > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">SPD</span>{p.sp.spd}</div>
              <div className={p.sp.spe > 0 ? "text-red-500" : "text-zinc-700"}><span className="block text-[8px] font-bold text-zinc-500 uppercase mb-1">SPE</span>{p.sp.spe}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {p.moves.map((m, idx) => (
              <div key={idx} className="bg-black/30 border border-zinc-850 rounded-xl px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:border-red-900/20 hover:text-white transition-colors duration-200 truncate">
                {m}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

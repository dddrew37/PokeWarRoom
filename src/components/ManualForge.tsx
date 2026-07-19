"use client";

import React, { useState, useMemo, useEffect } from "react";
import Combobox from "./Combobox";
import { ParsedPokemon, Stats } from "../lib/parser";
import { POKEBALL_FALLBACK } from "../lib/pokemon";
import metaData from "../data/meta_data.json";
import mbRoster from "../data/regulation_mb_roster.json";
import mbItemsMoves from "../data/regulation_mb_items_moves.json";

interface ManualForgeProps {
  onAddPokemon: (pokemon: ParsedPokemon) => void;
  onUpdatePokemon?: (pokemon: ParsedPokemon, index: number) => void;
  canAdd: boolean;
  team?: ParsedPokemon[];
  activeEditIndex?: number | null;
  onCancelEdit?: () => void;
}

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
type StatKey = typeof STAT_KEYS[number];

function convertSPtoEV(sp: number): number {
  if (sp <= 0) return 0;
  if (sp >= 32) return 252; // or 244 based on the cap
  return (sp - 2) * 8 + 4;
}

export default function ManualForge({ onAddPokemon, onUpdatePokemon, canAdd, team = [], activeEditIndex = null, onCancelEdit }: ManualForgeProps) {
  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [ability, setAbility] = useState("");
  const [nature, setNature] = useState("");
  const [moves, setMoves] = useState<string[]>(["", "", "", ""]);
  
  const [sp, setSp] = useState<Stats>({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  const [spExplanations, setSpExplanations] = useState<Record<string, string>>({});

  // Two-way hydration for edit mode
  useEffect(() => {
    if (activeEditIndex !== null && team[activeEditIndex]) {
      const p = team[activeEditIndex];
      // Lookup canonical name in metadata if it was modified
      const metadataMon = metaData.pokemon.find(m => m.name.toLowerCase() === p.name.toLowerCase());
      setName(metadataMon ? metadataMon.name : p.name);
      
      const canonicalItem = mbItemsMoves.legal_items.find(i => i.toLowerCase() === (p.item || "").toLowerCase()) || p.item || "";
      setItem(canonicalItem);
      
      const canonicalAbility = metadataMon?.abilities.find(a => a.toLowerCase() === (p.ability || "").toLowerCase()) || p.ability || "";
      setAbility(canonicalAbility);
      
      setNature(p.nature || "");
      
      const availableMovesRaw = metadataMon ? metadataMon.moves : mbItemsMoves.legal_moves;
      const availableMoves = availableMovesRaw.filter(m =>
        mbItemsMoves.legal_moves.map(lm => lm.toLowerCase()).includes(m.toLowerCase())
      );
      const matchMove = (m: string) => {
        if (!m) return "";
        return availableMoves.find(am => am.toLowerCase() === m.toLowerCase()) || m;
      };
      
      setMoves([
        matchMove(p.moves[0]),
        matchMove(p.moves[1]),
        matchMove(p.moves[2]),
        matchMove(p.moves[3])
      ]);
      setSp(p.sp);
      setSpExplanations(p.spExplanations || {});
    }
  }, [activeEditIndex, team]);

  const totalSP = useMemo(() => {
    return sp.hp + sp.atk + sp.def + sp.spa + sp.spd + sp.spe;
  }, [sp]);

  const SP_CAP = 66;
  const STAT_CAP = 32;
  const spRemaining = SP_CAP - totalSP;

  const getStatExplanation = (statName: string): string | undefined => {
    if (!spExplanations) return undefined;
    const lowerName = statName.toLowerCase();
    
    // Check standard abbreviations
    if (spExplanations[lowerName]) return spExplanations[lowerName];
    
    // Check full names or capitalized versions
    for (const key of Object.keys(spExplanations)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === lowerName) return spExplanations[key];
      if (lowerName === "atk" && (lowerKey === "attack" || lowerKey === "phys_atk")) return spExplanations[key];
      if (lowerName === "def" && (lowerKey === "defense" || lowerKey === "phys_def")) return spExplanations[key];
      if (lowerName === "spa" && (lowerKey === "special attack" || lowerKey === "special_attack" || lowerKey === "spa")) return spExplanations[key];
      if (lowerName === "spd" && (lowerKey === "special defense" || lowerKey === "special_defense" || lowerKey === "spd")) return spExplanations[key];
      if (lowerName === "spe" && (lowerKey === "speed" || lowerKey === "spe")) return spExplanations[key];
    }
    return undefined;
  };

  const handleStatChange = (stat: StatKey, value: number) => {
    let newVal = Math.max(0, Math.min(value, STAT_CAP));
    
    // Ensure we don't exceed the total cap
    const currentTotalExcludingThisStat = totalSP - sp[stat];
    if (currentTotalExcludingThisStat + newVal > SP_CAP) {
      newVal = SP_CAP - currentTotalExcludingThisStat;
    }

    const valueChanged = newVal !== sp[stat];
    setSp(prev => ({ ...prev, [stat]: newVal }));
    
    if (valueChanged) {
      setSpExplanations(prev => {
        const next = { ...prev };
        const lowerStat = stat.toLowerCase();
        for (const k of Object.keys(next)) {
          const lk = k.toLowerCase();
          if (lk === lowerStat || 
              (lowerStat === "atk" && lk === "attack") ||
              (lowerStat === "def" && lk === "defense") ||
              (lowerStat === "spa" && (lk === "special attack" || lk === "special_attack")) ||
              (lowerStat === "spd" && (lk === "special defense" || lk === "special_defense")) ||
              (lowerStat === "spe" && lk === "speed")) {
            delete next[k];
          }
        }
        return next;
      });
    }
  };

  const handleAdd = () => {
    console.log("--- UPDATE / ADD POKEMON TRIGGERED ---");
    console.log("[ManualForge] State at trigger:", { name, item, ability, nature, moves, sp, totalSP, canSubmit, activeEditIndex });

    if (!name.trim()) {
      console.warn("[ManualForge] Guard: name is empty. Aborting.");
      alert("Cannot save: Species name is required. Please select a Pok\u00e9mon from the dropdown.");
      return;
    }

    const hasAtLeastOneMove = moves.some(m => m.trim() !== "");
    const isEditing = activeEditIndex !== null;
    const canSubmitNow = (canAdd || isEditing) && name.trim() !== "" && hasAtLeastOneMove && totalSP <= 66;

    // Diagnostic: log exactly which required conditions are failing
    if (!canSubmitNow) {
      const reasons: string[] = [];
      if (name.trim() === "") reasons.push(`Species name is required`);
      if (totalSP > 66) reasons.push(`Total SP (${totalSP}) exceeds 66`);
      if (!hasAtLeastOneMove) reasons.push(`At least one move is required`);
      if (!canAdd && !isEditing) reasons.push(`Roster is full (6/6) and you are not in edit mode`);
      console.warn("[ManualForge] canSubmit=false. Blocking reasons:", reasons);
      alert("Cannot save Pok\u00e9mon:\n\n" + reasons.map(r => "\u2022 " + r).join("\n"));
      return;
    }

    if (totalSP > 66) {
      console.warn(`[ManualForge] Guard: totalSP=${totalSP} exceeds 66. Aborting.`);
      alert(`Invalid configuration: Total SP (${totalSP}) exceeds the maximum of 66. Please adjust the sliders before saving.`);
      return;
    }

    const hasExceededCap = STAT_KEYS.some(key => sp[key] > 32);
    if (hasExceededCap) {
      const offenders = STAT_KEYS.filter(k => sp[k] > 32).map(k => `${k.toUpperCase()}=${sp[k]}`).join(", ");
      console.warn(`[ManualForge] Guard: stat cap exceeded: ${offenders}`);
      alert(`Invalid configuration: One or more stats exceed the individual cap of 32 SP (${offenders}). Please adjust the sliders before saving.`);
      return;
    }

    const evs: Stats = {
      hp: convertSPtoEV(sp.hp),
      atk: convertSPtoEV(sp.atk),
      def: convertSPtoEV(sp.def),
      spa: convertSPtoEV(sp.spa),
      spd: convertSPtoEV(sp.spd),
      spe: convertSPtoEV(sp.spe),
    };

    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    const newMon: ParsedPokemon = {
      id,
      name: name.trim(),
      item: item.trim(),
      ability: ability.trim(),
      nature: nature.trim(),
      evs,
      sp,
      moves: moves.map(m => m.trim()).filter(Boolean),
      spExplanations,
    };

    if (activeEditIndex !== null && onUpdatePokemon) {
      onUpdatePokemon(newMon, activeEditIndex);
    } else {
      onAddPokemon(newMon);
    }
    
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setItem("");
    setAbility("");
    setNature("");
    setMoves(["", "", "", ""]);
    setSp({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    setSpExplanations({});
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const pokemonOptions = useMemo(() => {
    return metaData.pokemon
      .filter(p => {
        const lower = p.name.toLowerCase();
        const id = p.id.toLowerCase();
        return mbRoster.legal_species.includes(lower) ||
               mbRoster.legal_forms.includes(lower) ||
               mbRoster.legal_megas.includes(lower) ||
               mbRoster.legal_species.some(s => lower.startsWith(s + "-")) ||
               mbRoster.legal_forms.some(f => lower.startsWith(f + "-")) ||
               mbRoster.legal_megas.some(m => lower.startsWith(m + "-")) ||
               mbRoster.legal_species.includes(id) ||
               mbRoster.legal_forms.includes(id) ||
               mbRoster.legal_megas.includes(id);
      })
      .map(p => p.name);
  }, []);

  const selectedPokemonData = useMemo(() => metaData.pokemon.find(p => p.name === name), [name]);
  const abilityOptions = selectedPokemonData ? selectedPokemonData.abilities : [];
  
  const availableMoves = useMemo(() => {
    const rawMoves = selectedPokemonData ? selectedPokemonData.moves : mbItemsMoves.legal_moves;
    return rawMoves.filter(m =>
      mbItemsMoves.legal_moves.includes(m) ||
      mbItemsMoves.legal_moves.map(lm => lm.toLowerCase()).includes(m.toLowerCase())
    );
  }, [selectedPokemonData]);

  const isValidSpecies = useMemo(() => pokemonOptions.includes(name), [pokemonOptions, name]);
  // Mega Stones end in 'ite' (Froslassite, Gardevoirite, etc.) and are always legal
  const isMegaStone = item.toLowerCase().endsWith('ite');
  const isValidItem = item !== "" && (
    isMegaStone || 
    mbItemsMoves.legal_items.includes(item) || 
    mbItemsMoves.legal_items.map(i => i.toLowerCase()).includes(item.toLowerCase())
  );
  const isValidAbility = ability !== "" && abilityOptions.includes(ability);
  const isValidNature = nature !== "";
  const isValidMoves = moves[0] !== "" && moves.every(m => 
    m === "" || 
    availableMoves.includes(m) || 
    availableMoves.map(am => am.toLowerCase()).includes(m.toLowerCase())
  );
  
  const hasAtLeastOneMove = moves.some(m => m.trim() !== "");
  const isEditing = activeEditIndex !== null;
  const canSubmit = (canAdd || isEditing) && name.trim() !== "" && hasAtLeastOneMove && totalSP <= 66;

  // Compute a human-readable list of unmet conditions for the tooltip / diagnostic
  const validationIssues: string[] = [];
  if (!isValidSpecies) validationIssues.push(`Species not set or not in Regulation MB legal list`);
  if (!isValidItem)    validationIssues.push(`Item not set or not in Regulation MB legal list (Mega Stones ending in "ite" are auto-allowed)`);
  if (!isValidAbility) validationIssues.push(`Ability not set or not valid for species`);
  if (!isValidNature)  validationIssues.push(`Nature not set`);
  if (!isValidMoves)   validationIssues.push(`Move 1 is required; all selected moves must be legal`);
  if (!canAdd && !isEditing) validationIssues.push(`Roster is full (6/6)`);

  return (
    <div className="w-full max-w-2xl bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col space-y-8 relative z-10">
        <div>
          <h3 className="text-2xl font-black text-white tracking-tight">
            {isEditing ? "Edit Pokémon" : "Draft Pokémon"}
          </h3>
          <p className="text-zinc-400 text-sm mt-1">Configure stats using the 66-SP math engine</p>
        </div>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Combobox label="Species" value={name} onChange={setName} options={pokemonOptions} placeholder="e.g. Incineroar" />
          <Combobox label="Item" value={item} onChange={setItem} options={mbItemsMoves.legal_items} placeholder="e.g. Sitrus Berry" />
          <Combobox label="Ability" value={ability} onChange={setAbility} options={abilityOptions} placeholder="e.g. Intimidate" />
          <Combobox label="Nature" value={nature} onChange={setNature} placeholder="e.g. Careful" />
        </div>

        {/* Selected Pokemon Info Card */}
        {selectedPokemonData && (
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-inner">
            <div className="flex items-center gap-3">
              <img src={`https://play.pokemonshowdown.com/sprites/gen5/${selectedPokemonData.id}.png`} alt={selectedPokemonData.name} className="w-16 h-16 object-contain drop-shadow-md" onError={(e) => { e.currentTarget.src = POKEBALL_FALLBACK; }} />
              <div>
                <div className="flex gap-2 mb-1">
                  {selectedPokemonData.types.map(t => (
                    <span key={t} className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded bg-zinc-800 text-zinc-300 border border-zinc-700">{t}</span>
                  ))}
                </div>
                <div className="text-xs text-zinc-400 font-medium">Abilities: <span className="text-zinc-300">{selectedPokemonData.abilities.join(" / ")}</span></div>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              {STAT_KEYS.map(stat => (
                <div key={stat} className="flex flex-col items-center bg-zinc-900 rounded-lg p-2 min-w-[3rem] border border-zinc-800/50">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">{stat}</span>
                  <span className="text-sm font-black text-white">{selectedPokemonData.baseStats[stat]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Moves */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Moveset</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => (
              <Combobox 
                key={i} 
                label={`Move ${i + 1}`} 
                value={moves[i]} 
                onChange={(val) => {
                  const newMoves = [...moves];
                  newMoves[i] = val;
                  setMoves(newMoves);
                }} 
                options={availableMoves}
                placeholder="Select Move" 
              />
            ))}
          </div>
        </div>

        {/* 66-SP Math Engine */}
        <div className="bg-zinc-950 rounded-2xl p-6 border border-zinc-800">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-bold text-white">Stat Distribution</h4>
              <p className="text-xs text-zinc-500 mt-1">Max 32 SP per stat</p>
            </div>
            <div className={`px-4 py-2 rounded-xl font-black text-sm tracking-widest ${spRemaining === 0 ? 'bg-red-950/20 text-red-500 border border-red-900/30' : 'bg-zinc-900/50 text-zinc-400 border border-zinc-800'}`}>
              SP REMAINING: {spRemaining}/66
            </div>
          </div>

          <div className="space-y-4">
            {STAT_KEYS.map((stat) => {
              const explanation = getStatExplanation(stat);
              return (
                <div key={stat} className="flex items-center gap-4">
                  <div className="w-12 text-sm font-bold text-zinc-400 uppercase text-right tracking-wider flex items-center justify-end gap-1">
                    <span>{stat}</span>
                    {explanation && (
                      <span 
                        title={explanation} 
                        className="cursor-help text-red-500 hover:text-red-450 text-[11px] font-mono select-none"
                      >
                        ⓘ
                      </span>
                    )}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={sp[stat]}
                    onChange={(e) => handleStatChange(stat, parseInt(e.target.value) || 0)}
                    className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                  <input
                    type="number"
                    min="0"
                    max="32"
                    value={sp[stat]}
                    onChange={(e) => handleStatChange(stat, parseInt(e.target.value) || 0)}
                    className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-center text-sm font-bold text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          {isEditing && (
            <button
              onClick={resetForm}
              className="px-6 py-4 rounded-2xl font-black text-lg transition-all duration-300 bg-zinc-800 border-2 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white uppercase tracking-wide flex-shrink-0"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAdd}
            className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all duration-300 border-2 uppercase tracking-wide flex items-center justify-center gap-2 ${
              canSubmit
                ? "bg-red-700 border-red-500 text-white hover:bg-red-600 hover:border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                : "bg-zinc-850 border-zinc-800 text-zinc-600 cursor-not-allowed"
            }`}
          >
            {canAdd || isEditing ? (
              <>
                <span>{isEditing ? "Update Pokémon" : "Add to Roster"}</span>
                {!isEditing && (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </>
            ) : (
              <span>Roster Full (6/6)</span>
            )}
          </button>
        </div>

        {/* Validation diagnostics — visible when the form is incomplete or has DB mismatches */}
        {validationIssues.length > 0 && (
          <div className="bg-zinc-950 border border-red-950/40 rounded-xl p-3 space-y-1">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Database mismatch warnings (Force Update available):</p>
            {validationIssues.map((issue, i) => (
              <p key={i} className="text-[11px] text-zinc-400 font-medium">• {issue}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

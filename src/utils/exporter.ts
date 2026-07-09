import { ParsedPokemon } from "../lib/parser";

export function exportTeamToPokepaste(team: ParsedPokemon[]): string {
  const chunks = team.map((pokemon) => {
    let text = `${pokemon.name}${pokemon.item ? ` @ ${pokemon.item}` : ""}\n`;
    if (pokemon.ability) text += `Ability: ${pokemon.ability}\n`;
    text += `Level: 50\n`;

    const evStrings: string[] = [];
    if (pokemon.sp) {
      if (pokemon.sp.hp > 0) evStrings.push(`${pokemon.sp.hp} HP`);
      if (pokemon.sp.atk > 0) evStrings.push(`${pokemon.sp.atk} Atk`);
      if (pokemon.sp.def > 0) evStrings.push(`${pokemon.sp.def} Def`);
      if (pokemon.sp.spa > 0) evStrings.push(`${pokemon.sp.spa} SpA`);
      if (pokemon.sp.spd > 0) evStrings.push(`${pokemon.sp.spd} SpD`);
      if (pokemon.sp.spe > 0) evStrings.push(`${pokemon.sp.spe} Spe`);
    }

    if (evStrings.length > 0) {
      text += `EVs: ${evStrings.join(" / ")}\n`;
    }

    if (pokemon.nature) {
      text += `${pokemon.nature} Nature\n`;
    }

    if (pokemon.moves && pokemon.moves.length > 0) {
      pokemon.moves.forEach((move) => {
        if (move) text += `- ${move}\n`;
      });
    }

    return text.trim();
  });

  return chunks.join("\n\n");
}

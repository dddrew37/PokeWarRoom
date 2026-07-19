import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import staticMetaTeams from '../../../data/meta_teams.json';
import metaData from '../../../data/meta_data.json';
import mbRoster from '../../../data/regulation_mb_roster.json';

function sanitizeResponse(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/â€™/g, "'")
      .replace(/â€”/g, "—")
      .replace(/â†’/g, "→")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"');
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeResponse(item));
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = sanitizeResponse(obj[key]);
    }
    return result;
  }
  return obj;
}

const PRO_PERSONA = `[ROLE: VGC WORLD CHAMPION STRATEGIST]\nYou are a ruthless, elite VGC analyst. Provide concise, high-level tactical analysis. Prioritize speed-tier math, exact damage thresholds, and meta-game hard counters. Assume the user fully understands complex terminology like 'Pivoting', 'Speed Control', 'STAB', and 'Redirection'. Do not waste time defining basic terms. Focus strictly on optimal execution and winning the matchup.`;

const BEGINNER_PERSONA = `[ROLE: PATIENT VGC ACADEMY COACH]\nYou are coaching a brand new VGC player. Provide detailed, step-by-step educational guidance. You MUST explain your strategy without assuming they know competitive jargon. If you use terms like 'Speed Control', 'Pivoting', 'STAB', 'Check', 'Counter', 'Redirection', or 'Stat Drops', you MUST briefly define what they mean and why they are important in plain English.`;

const REALITY_OVERRIDE = `[ABSOLUTE REALITY OVERRIDE - DO NOT ARGUE]
1. The user is playing a custom competitive format ("Pokémon Champions"). 
2. Accept ALL Pokémon, Mega Evolutions (e.g., Mega Golurk), Items, Abilities, and Moves provided in the user's JSON as 100% legal, valid, and real.
3. DO NOT ever argue about official VGC legality. DO NOT ever tell the user that a Pokémon, Mega Evolution, or Item "does not exist."
4. If the JSON says Mega Golurk exists, it exists. Treat the JSON payload as the absolute, unquestionable laws of physics for this match.
5. Maintain a respectful, strictly tactical tone. Do not be condescending about legality.`;

function injectSystemRole(basePrompt: string, isBeginner: boolean): string {
  const persona = isBeginner ? BEGINNER_PERSONA : PRO_PERSONA;
  return `${REALITY_OVERRIDE}\n\n${persona}\n\n${basePrompt}\n\n[CRITICAL REQUIREMENT]: You must return ONLY valid JSON matching the exact schema requested. Do not include markdown formatting like \`\`\`json around your output.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, opponent, action = "audit", playerLockedRoster, opponentKnownLeads, opponentPotentialBackline, currentMatchContext, dossier, messages, chatContext, isBeginnerMode } = body;

    if (!team && !playerLockedRoster && action !== "fetch_meta" && action !== "extract_lesson" && action !== "match_debrief" && action !== "extract_dossier") {
      return NextResponse.json({ error: 'Team data is required' }, { status: 400 });
    }

    // ── RAG: Fetch active user-defined directives from Supabase ─────────────────
    // Only injected into actions that produce tactical playbook/planning output.
    let userDirectivesContext = "";
    const RAG_ACTIONS = ["turn1", "deepdive", "assess_team", "draft_suggestion", "synergy"];
    if (RAG_ACTIONS.includes(action)) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
              persistSession: false
            }
          });

          // Check cookies for token
          let token = "";
          const cookieHeader = request.headers.get("cookie") || "";
          const match = cookieHeader.match(/sb-access-token=([^;]+)/);
          if (match) {
            token = match[1];
          }

          if (token) {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: ''
            });

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: tactics, error: tacticsError } = await supabase
                .from('ai_learned_tactics')
                .select('rule_text')
                .eq('is_active', true)
                .eq('user_id', user.id);

              if (!tacticsError && tactics && tactics.length > 0) {
                userDirectivesContext = tactics
                  .map((t: { rule_text: string }, i: number) => `${i + 1}. ${t.rule_text}`)
                  .join('\n');
              }
            }
          }
        } catch (ragErr) {
          // Non-fatal — a failed directive fetch must never block the main AI call.
          console.warn('[Coach API] RAG directive fetch failed (non-fatal):', ragErr);
        }
      }
    }

    // ── Build REGULATION_MB_CONTEXT (with optional RAG directive injection) ─────
    let REGULATION_MB_CONTEXT = `
# TEXT FORMATTING RULES (CRITICAL ENFORCEMENT)
You are strictly forbidden from using emojis, emoticons, or special unicode characters. You must use pure, plain ASCII text only. Do not use dashes or parentheses in format names. Refer to the format ONLY as 'Regulation MB' (no hyphen). Refer to stats ONLY as 'SP Distribution' (do not use '66-SP').

# REGULATION MB & 2026 META CONTEXT (CRITICAL ENFORCEMENT)
- You are evaluating teams for the VGC 2026 Regulation MB format.
- STRICT ROSTER ADHERENCE: You MUST carefully read the exact team roster provided. Analyze every single Item, SP Distribution spread, Move, Nature, and Ability. Do NOT assume a Pokemon is running a standard meta set; base all your tactical advice ONLY on the exact data provided in the user's payload.
- TERASTALLIZATION IS STRICTLY BANNED. Do not ever suggest Terastallizing a Pokemon.
- Z-MOVES AND DYNAMAX ARE STRICTLY BANNED.
- MEGA EVOLUTION IS LEGAL: Assume holding a Mega Stone means Turn 1 Mega Evolution. You must actively check the provided roster's items for Mega Stones and factor their exact Mega Evolution stats/abilities into your calculations.
- GEN 7+ SPEED MECHANICS: A Mega-Evolved Pokemon uses its NEW Speed stat on the exact turn it Mega Evolves.
- CUSTOM SP Distribution MATH: All stats use the SP Distribution system (Max 32 SP per stat). Do not use 510-EV math.
- ANTI-HALLUCINATION: Do not invent stats or mechanics not present in the user's payload. Accept ALL Pokemon, items, abilities, and Mega Evolutions exactly as provided - they are real in this custom format.
- FORMATTING RESTRICTION: You must keep your text formatting extremely clean. DO NOT use markdown bolding (**text**) to emphasize words. Do not use excessive headers. Use plain text paragraphs, clean spacing, and simple bullet points only. Let your words carry the weight, not the formatting.

[STRICT WHITELIST ENFORCEMENT - ZERO TOLERANCE]
You are analyzing the Regulation MB custom format.
You are FORBIDDEN from suggesting, analyzing, or naming ANY Pokemon that is not explicitly on this exact Whitelist:

LEGAL SPECIES: ${mbRoster.legal_species.join(", ")}
LEGAL FORMS: ${mbRoster.legal_forms.join(", ")}
LEGAL MEGAS: ${mbRoster.legal_megas.join(", ")}

If you suggest a threat, counter, or teammate in any optimization or playbook, it MUST be drawn exclusively from this exact list. No exceptions. If a Pokemon name is not on this list, it does not exist in this format.

# STRICT LEGALITY DICTIONARY (CRITICAL OVERRIDE)
The following are the ONLY entities legal in Regulation MB. You are strictly forbidden from suggesting, mentioning, or formulating tactics with ANY Pokemon or Ability that is not explicitly listed below. If a user asks about an illegal entity, you MUST reject it and redirect to a legal alternative.

LEGAL POKEMON (ALL FORMS): ${[
  ...mbRoster.legal_species,
  ...mbRoster.legal_forms,
  ...mbRoster.legal_megas
].map((s: string) => s.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join('-')).join(", ")}

LEGAL ABILITIES: ${[
  ...new Set<string>(
    (metaData as any).pokemon
      .flatMap((p: any) => (p.abilities ?? []) as string[])
      .filter(Boolean)
  )
].sort().join(", ")}

IRONCLAD COMMAND: Under no circumstances may you hallucinate a Pokemon or Ability that does not appear in the lists above. If a user's roster contains a custom entity, treat it as valid per the ABSOLUTE REALITY OVERRIDE - but never suggest new unlisted entities in your output.

# EXPLICITLY BANNED (PRE-TRAINED BIAS OVERRIDE)
Urshifu (all forms), Flutter Mane, Tornadus, Amoonguss, and Ogerpon are BANNED in this format. You are strictly forbidden from generating tactics that use or mention them unless the user explicitly forces them in their own roster.

[MANDATORY CHAIN-OF-THOUGHT LEGALITY CHECK]
Before suggesting ANY Pokemon, Mega Evolution, or Item in your JSON output, you MUST:
1. Cross-reference EVERY proposed Pokemon against the STRICT LEGALITY DICTIONARY above.
2. Output your verification in the "legality_verification" array at the VERY TOP of your JSON response.
3. If is_in_strict_dictionary is false for any proposed Pokemon, you MUST discard it and pick a legal alternative from the dictionary immediately.
4. Do NOT output any Pokemon that fails this check. The legality_verification array proves you performed due diligence.
`;

    if (userDirectivesContext) {
      REGULATION_MB_CONTEXT += `
# USER-DEFINED TACTICAL DIRECTIVES (CRITICAL OVERRIDE):
The user has explicitly defined the following permanent rules. You MUST obey them regardless of standard meta logic:
${userDirectivesContext}
`;
    }

    const auditSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a Pokemon VGC Coach. Perform a findings-first competitive audit and turn the team into real opening plans instead of fake full-game scripts.

# ADDITIONAL RULES:
- FAKE OUT & FIRST IMPRESSION: These priority moves ONLY work on the absolute first turn a Pokémon is on the field. You must NEVER suggest these moves if the Pokémon was already active on the previous turn. Covert Cloak, Inner Focus, and Ghost-types (without Scrappy) are immune to Fake Out.
- TURN STATE AWARENESS: Before suggesting ANY move, you must check the provided board state/turn history to verify if the Pokémon just switched in, or if it is already active.
- PROTECT CHAINING: Protect, Detect, Spiky Shield, and Wide Guard have a massive failure rate (approx. 66%) if used on consecutive turns. Never suggest double-Protecting unless it is a desperate, game-ending contingency.
- PRANKSTER IMMUNITY: Dark-type Pokémon are completely immune to opponent moves boosted by the Prankster ability.



# VGC Team Audit & Lead Planner

1. Identify what the team is trying to establish early before criticizing it.

2. Separate structural flaws from stylistic differences. Surface the highest-impact issues first, tied to concrete gameplay consequences.

3. Recommend one clear default lead that fits the normal game plan.

4. Name preserve targets explicitly so the plan is not just "bring strong mons".

5. Change leads only when the matchup meaningfully changes the opening incentives. Tie each lead to a concrete first-turn goal (e.g. board stabilization, speed control, immediate pressure).



# DEEP CONTEXT REQUIREMENT (Abilities, Speed, Items)

- Analyze and factor in Pokémon Abilities (e.g., Intimidate, Weather/Terrain setters, redirections like Follow Me/Rage Powder, Prankster).

- Analyze Speed Tiers (e.g., who outspeeds who naturally, Tailwind modifiers, Trick Room).

- Analyze Item synergies (e.g., Focus Sash protecting against OHKOs, Choice items locking moves, Assault Vest).

- STRICT INSTRUCTION: Your \`tactical_rationale\` and \`expected_board_state\` MUST explicitly mention how the opponent's known abilities, items, or speed tiers dictate our lead choices, turn-by-turn targeting, and positioning.



# Avoid These Failure Modes

- same lead into every matchup

- preserve targets that do not match the proposed lead

- first-turn goals that are too vague to act on

- matchup plans that assume unsupported current-meta facts

- repeating one lead pair for every matchup

- hiding uncertainty behind fake confidence



# CRITICAL TURN DEPTH REQUIREMENT

Each flowchart MUST contain between 3 and 6 turns. Do NOT stop after Turn 1. The player needs actionable plans for Turn 1 through at least Turn 3. Include pivots, switches, and follow-up attacks.



# CHAIN OF THOUGHT: DECISION AUDIT (CRITICAL)

Before mapping the \`turns\`, you MUST evaluate the board state step-by-step.
You must specifically ask yourself: "Is this move mechanically legal based on the turn history, and have I accounted for Mega Evolution stat/ability changes?"
Your JSON MUST include a \`decision_audit\` object containing:
- \`speed_tier_analysis\`: Who goes first based on base stats, Tailwind, or Trick Room.
- \`primary_threat_identified\`: Which opponent Pokémon poses the immediate highest risk.
- \`risk_assessment_justification\`: Why you chose the primary strategy instead of pivoting or using an alternative plan. Ensure you explicitly verify mechanical legality and Mega Evolution mechanics here.
This forces you to "show your work" using strict competitive VGC logic.



# VGC DOUBLES SCHEMA REQUIREMENT

This is a VGC Doubles format. Every turn MUST have exactly 2 player actions. You MUST explicitly name the 2 Leads and the 2 In The Back for each path.



You must output your response STRICTLY as a JSON object matching this schema so the frontend can render branching flowcharts:

{
  "audit": {
    "team_identity": "Brief summary of what the team wants to establish early.",
    "preserve_targets": ["Pokemon Name"],
    "top_findings": "Highest impact structural observations."
  },
  "decision_audit": {
    "speed_tier_analysis": "Explanation of speed control.",
    "primary_threat_identified": "Analysis of the biggest threat.",
    "risk_assessment_justification": "Why this specific play is the best."
  },
  "primary_win_condition": {
    "path_name": "Primary Win Condition",
    "leads": ["Pokemon 1", "Pokemon 2"],
    "in_the_back": ["Pokemon 3", "Pokemon 4"],
    "turns": [
      { 
        "turn_number": 1, 
        "player_actions": [
          { "pokemon": "Pokemon 1", "action": "Fake Out", "target": "Primary Threat", "damage_estimation": "Chip Damage", "mechanic_trigger": "Flinch" },
          { "pokemon": "Pokemon 2", "action": "Tailwind", "target": "Self", "damage_estimation": "None", "mechanic_trigger": "Speed Control" }
        ],
        "expected_board_state": "Opponent will likely attempt to set Trick Room.",
        "tactical_rationale": "Fake Out flinches the redirector so Tailwind can go up safely."
      }
    ]
  },
  "contingency_plans": [
    {
      "path_name": "Vs Hard Trick Room",
      "leads": ["Pokemon 1", "Pokemon 3"],
      "in_the_back": ["Pokemon 2", "Pokemon 4"],
      "turns": [
        { 
          "turn_number": 1, 
          "player_actions": [
            { "pokemon": "Pokemon 1", "action": "Spore", "target": "Trick Room Setter", "damage_estimation": "None", "mechanic_trigger": "Sleep" },
            { "pokemon": "Pokemon 3", "action": "U-turn", "target": "Redirector", "damage_estimation": "Chip Damage", "mechanic_trigger": "Pivot" }
          ],
          "expected_board_state": "Opponent will redirect with Follow Me.",
          "tactical_rationale": "Spore puts the setter to sleep."
        }
      ]
    }
  ]
}

Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const fetchMetaSystemPrompt = `${REGULATION_MB_CONTEXT}

You are an expert VGC analyst with knowledge of the current Pokemon VGC 2026 Regulation MB competitive landscape.
Your task is to output exactly 5 distinct, high-level competitive tournament teams that are currently strong in the Regulation MB format.
Regulation MB includes Mega Evolutions and the latest Pokemon series up to the current date.

Each team MUST contain EXACTLY 6 Pokemon entries written in Pokemon Showdown import format (also called PokePaste).
Separate each Pokemon block with exactly TWO blank lines (\n\n).
Each block MUST include: Species @ Item, Ability, Nature, and at least 2 moves prefixed with "- ".

You MUST output ONLY a raw JSON object. Do NOT add any commentary, markdown, or explanatory text.
The JSON object MUST match this exact schema:
{
  "teams": [
    {
      "name": "Descriptive team archetype name (e.g. Tailwind Rain, Hard Trick Room)",
      "paste": "Full 6-Pokemon PokePaste text with double-newline separators"
    }
  ]
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const optimizeSystemPrompt = `${REGULATION_MB_CONTEXT}

You are an expert Pokemon VGC Teambuilder. Your task is to calculate optimal SP Distribution math distributions for the provided team, complete the roster to exactly 6 Pokemon, and optimize items, moves, abilities, and natures as needed.

# SP Distribution Math Engine Constraints
1. The SP (Stat Point) system uses a strict maximum of 66 total SP per Pokemon.
2. The total sum of SP across HP, atk, def, spa, spd, and spe MUST EXACTLY EQUAL 66.
3. NO individual stat can exceed 32 SP. (0 is the minimum).
4. Standard 252 EVs map exactly to 32 SP. 4 EVs map to 2 SP.

# teambuilding & autocomplete rules:
- If the user provides fewer than 6 Pokemon, you MUST generate synergistic meta Pokemon to fill the empty slots so the returned optimized_team array always contains exactly 6 Pokemon.
- You are authorized to change items, abilities, natures, and moves if the user's current selections are unviable in the Regulation MB VGC meta.
- Document every change (including adding new Pokemon, changing moves/items/abilities/natures) in the optimization_report.
- For every stat that has an SP allocation greater than 0, you must provide a 1-sentence educational explanation in the spExplanations object.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "optimized_team": [
    { 
      "id": "pokemon_id",
      "name": "Pokemon Name",
      "item": "Focus Sash",
      "ability": "Intimidate",
      "nature": "Jolly",
      "moves": ["Fake Out", "Knock Off", "Parting Shot", "Protect"],
      "sp": { "hp": 0, "atk": 32, "def": 0, "spa": 0, "spd": 2, "spe": 32 },
      "spExplanations": {
        "atk": "Maximized to secure critical physical KOs.",
        "spd": "Remaining 2 points allocated to Special Defense to survive specs attacks.",
        "spe": "Maximized to outspeed default base 100 speed tiers."
      }
    }
  ],
  "optimization_report": [
    {
      "pokemon": "Incineroar",
      "changes": ["Changed item from Leftovers to Sitrus Berry.", "Swapped U-turn for Knock Off."],
      "rationale": "Sitrus Berry provides immediate burst healing which Incineroar prefers over gradual Leftovers recovery. Knock Off is strictly better in this meta to remove Clear Amulets."
    }
  ]
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const assessSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach analyzing a Regulation MB team.
Identify structural vulnerabilities and recommend strong opening leads based on the team's composition.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "modes": [
    {
      "name": "Mode Name (e.g. Hard Trick Room, Fast Aggro)",
      "pokemon": ["Pokemon 1", "Pokemon 2", "Pokemon 3", "Pokemon 4"],
      "whenToUse": "Explanation of when this core is optimal and which matchups it counters."
    }
  ]
}`;

    const turn1SystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach sitting in the War Room mid-match. Turn 1 has started.

# The Board State
- You know exactly which 4 Pokemon the player brought.
- You know exactly which 2 Pokemon the opponent led with.
- The opponent has 4 Potential Backline Pokemon (only 2 of them were brought, but you don't know which 2).

# Turn 1 Tactical Recalculation
1. Analyze the exact 2v2 opening matchup (Player Leads vs Opponent Leads).
2. Assess immediate threats: who moves first, who threatens OHKOs, who has Fake Out/redirection/speed control.
3. Recommend the safest and most advantageous Turn 1 play for the player.
4. Keep the 'Potential Backline' in mind. If the opponent has a safe switch-in to your attacks, warn the player and suggest a read.

# VGC DOUBLES SCHEMA REQUIREMENT
Every turn MUST have exactly 2 player actions. You MUST explicitly name the 2 Leads and the 2 In The Back for each path.

# CHAIN OF THOUGHT: DECISION AUDIT (CRITICAL)
Before providing the turn actions, you MUST evaluate the board state step-by-step.
Include a \`decision_audit\` object containing:
- \`speed_tier_analysis\`: Who goes first based on base stats, Tailwind, or Trick Room.
- \`primary_threat_identified\`: Which opponent Pokemon poses the immediate highest risk.
- \`risk_assessment_justification\`: Why you chose the primary strategy instead of pivoting or using an alternative plan. Ensure you explicitly verify mechanical legality and Mega Evolution mechanics here.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "audit": {
    "team_identity": "Matchup analysis of the opening board state.",
    "preserve_targets": ["Crucial Pokemon to keep alive against their backline"],
    "top_findings": "Immediate Turn 1 tactical threats and positioning advantages."
  },
  "decision_audit": {
    "speed_tier_analysis": "Explanation of speed control.",
    "primary_threat_identified": "Analysis of the biggest threat.",
    "risk_assessment_justification": "Why this specific play is the best."
  },
  "primary_win_condition": {
    "path_name": "Turn 1 Execution",
    "leads": ["Player Lead 1", "Player Lead 2"],
    "in_the_back": ["Player Back 1", "Player Back 2"],
    "turns": [
      { 
        "turn_number": 1, 
        "player_actions": [
          { "pokemon": "Player Lead 1", "action": "Move", "target": "Target", "damage_estimation": "...", "mechanic_trigger": "..." },
          { "pokemon": "Player Lead 2", "action": "Move", "target": "Target", "damage_estimation": "...", "mechanic_trigger": "..." }
        ],
        "expected_board_state": "...",
        "tactical_rationale": "..."
      }
    ]
  },
  "contingency_plans": [
    {
      "path_name": "Turn 2 Contingencies",
      "leads": ["Player Lead 1", "Player Lead 2"],
      "in_the_back": ["Player Back 1", "Player Back 2"],
      "turns": []
    }
  ]
}`;

    const draftSuggestionSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach. The player is in the Team Preview phase against their opponent.
Your task is to analyze the Player's 6-man roster and the Opponent's 6-man roster, and suggest exactly 4 Pokemon for the player to bring into the match.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "suggestedDraft": ["Pokemon A", "Pokemon B", "Pokemon C", "Pokemon D"],
  "suggestedLeads": ["Pokemon A", "Pokemon B"],
  "rationale": "A brief explanation of why these 4 Pokemon optimally counter the opponent's composition, and why those 2 are the best leads."
}`;

    const deepdiveSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach. The player has selected a specific 4-Pokemon draft to face the Opponent's 6-man team in Regulation MB.
Your task is to analyze this draft and provide a deep dive explanation.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "draft_justification": "Detailed explanation of why these specific 4 Pokemon are the optimal response to the opponent's roster.",
  "potential_weaknesses": ["String 1", "String 2", "String 3"],
  "things_to_watch_out_for": ["Threat 1", "Threat 2", "Threat 3"]
}`;

    const assessTeamSystemPrompt = `${REGULATION_MB_CONTEXT}

TONE DIRECTIVE: Speak with the absolute authority and extreme tactical depth of a World Champion. DO NOT give generic, beginner-level advice. Be highly opinionated, cite specific meta threats by name, and provide advanced, cutthroat VGC strategies.

You are a World Champion VGC Coach performing a deep-dive "Study Guide" assessment of a Regulation MB team.
Your task is to analyze the team's core identity, determine the absolute best 4-Pokemon lineup, and map out matchups against the top-tier Regulation MB meta.

You MUST base your entire analysis on the specific SP Distribution spreads, items, abilities, and movesets provided in the roster. Do not give generic advice. If a Pokemon has 32 Speed SP, explain how that exact speed tier dictates their gameplan. Keep explanations deeply detailed but extremely easy to understand (jargon-free).

If the user is in Beginner Mode, you must scan the team for glaring structural weaknesses (e.g., '4 Pokemon are weak to Ground', 'Zero Protects on the team', 'No Speed Control'). Output 1 to 3 severe warnings in the red_flags array. If the team is structurally sound, or if Beginner Mode is disabled, leave the array empty.

You must score the team on a scale of 0 to 100 for these four pillars (offense, bulk, speed_control, synergy). Be highly critical. An all-attack team should have 90 Offense but 10 Bulk. A team with no Tailwind or Trick Room should have 0 Speed Control.

[BRING 6 PICK 4 - MULTI-CORE MANDATE]
VGC teams play "Bring 6, Pick 4". Your roster contains multiple distinct viable cores. You MUST identify exactly 4 named cores a player can build their game plan around. Do NOT collapse them into a single team.

[STRICT MATCHUP & WHITE LIST CONSTRAINTS]
- You MUST output exactly 4 distinct optimal_cores. Each core is 4 Pokemon chosen from the provided 6-man roster. Cores may overlap in membership.
- You MUST generate exactly 6 detailed matchup strategies (meta_matchups) against 6 different top-tier Regulation MB meta archetypes. Each matchup must name which of the 4 optimal_cores the player should select.
- Ensure the meta teams you invent for the opponent strictly adhere to the Regulation MB Whitelist (NO Urshifu, NO Calyrex, NO Paradoxes).

[TACTICAL MANDATE: HYPER-AGGRESSION & BOARD CONTROL]
Your strategies must NOT be passive. Do not default to safe, defensive switching unless absolutely necessary. You must dictate the pace of the game.
1. PRIORITIZE KOs OVER SURVIVAL: If a Turn 1 sequence results in a 1-for-1 trade that removes the opponent's primary win condition (e.g., their Trick Room setter or Tailwind user), take the trade.
2. EXPLOIT HARD READS: Instruct the Challenger to make aggressive reads. (e.g., "They will likely protect X, so double target Y," or "Ignore their redirector and hit the incoming switch.")
3. MAXIMUM PRESSURE: Emphasize offensive momentum, trapping (Shadow Tag/Perish), and immediate speed control dominance. Force the opponent onto their back foot from Turn 1.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "legality_verification": [
    {"proposed_pokemon": "Every Pokemon you mention in this response", "is_in_strict_dictionary": true}
  ],
  "red_flags": ["Glaring teambuilding warning 1", "Glaring teambuilding warning 2"],
  "team_grades": {
    "offense": 85,
    "bulk": 60,
    "speed_control": 70,
    "synergy": 75
  },
  "core_identity": "Detailed description of the team's archetype and overall win condition.",
  "optimal_cores": [
    {
      "core_name": "Tailwind Offense",
      "pokemon_lineup": ["Pokemon 1", "Pokemon 2", "Pokemon 3", "Pokemon 4"],
      "strategy_summary": "How this core wins and when to use it."
    },
    {
      "core_name": "Trick Room Mode",
      "pokemon_lineup": ["Pokemon 1", "Pokemon 2", "Pokemon 3", "Pokemon 4"],
      "strategy_summary": "How this core wins and when to use it."
    },
    {
      "core_name": "Hyper Offense",
      "pokemon_lineup": ["Pokemon 1", "Pokemon 2", "Pokemon 3", "Pokemon 4"],
      "strategy_summary": "How this core wins and when to use it."
    },
    {
      "core_name": "Defensive Pivot",
      "pokemon_lineup": ["Pokemon 1", "Pokemon 2", "Pokemon 3", "Pokemon 4"],
      "strategy_summary": "How this core wins and when to use it."
    }
  ],
  "meta_matchups": [
    {
      "opponent_archetype": "Tailwind Rain (e.g., Pelipper / Archaludon / Basculegion)",
      "recommended_core": "Tailwind Offense",
      "turn_1_plan": "Describe exactly what moves to use Turn 1 to immediately apply pressure. Be ruthless and specific.",
      "play_by_play": {
        "turn_1": "Same content as turn_1_plan - exact moves to use Turn 1 to immediately apply pressure.",
        "turn_2": "Exact moves/pivots for Turn 2 based on the expected Turn 1 board state.",
        "turn_3": "Exact moves/pivots for Turn 3.",
        "turn_4": "Exact moves/pivots for Turn 4, closing out the win condition."
      },
      "win_condition": "The critical path to victory - what needs to happen to close out the game."
    }
  ],
  "optimizations": [
    {
      "target_pokemon": "Pokemon Name",
      "suggested_tweak": "Suggested move, item, or SP Distribution point redistribution.",
      "rationale": "Why this tweak improves the team's synergy and matchups."
    }
  ],
  "legality_check": true
}`;

    let finalAssessTeamPrompt = assessTeamSystemPrompt;
    if (action === "assess_team" && chatContext && chatContext.length > 0) {
      finalAssessTeamPrompt += `\n\nCRITICAL OVERRIDE: The user has debated this roster with you. You MUST read the provided chat history and strictly update the optimal_cores, optimizations, and meta_matchups to reflect the final agreements reached in the chat.\nChat history:\n${JSON.stringify(chatContext, null, 2)}`;
    }

    const extractionSystemPrompt = `You are a highly analytical VGC data parser. Your ONLY job is to read a chat log between a player and a World Champion Coach and extract the definitive strategic rule or contingency they agreed upon. Output ONLY the rule as a single, commanding sentence. Start the sentence with 'MATCHUP OVERRIDE:'. Example: 'MATCHUP OVERRIDE: Do not lead Mega Sceptile against Rain/Kyogre cores.' Do not use markdown bolding. If the chat is just general banter and no specific rule was agreed upon, output exactly the string: NO_RULE`;

    const criticSystemPrompt = `
# CRITIC PERSONA:
You are a cynical, mathematically flawless VGC World Champion. Your only job is to review the Primary Draft VGC strategy/playbook and aggressively correct any game-losing mechanical errors, rule violations, or illegal plays under Regulation MB.

${REGULATION_MB_CONTEXT}

# CRITICAL VGC MECHANICS GUARDRAILS:
1. PRIORITY FAILURES:
   - Fake Out and Prankster-boosted moves fail completely against active Psychic Terrain.
   - Fake Out and Prankster-boosted moves fail completely against targets with Armor Tail or Queenly Majesty.
   - Fake Out fails against Inner Focus targets (they do not flinch).
   - Fake Out and First Impression ONLY work on the absolute first turn a Pokemon is on the field.

2. TYPE & ITEM IMMUNITIES:
   - Spore, Rage Powder, and other powder-based moves have zero effect against Grass-type Pokemon or Pokemon holding Safety Goggles.
   - Prankster Taunt and other Prankster-boosted status moves fail completely against Dark-type Pokemon.
   - Thunder Wave fails completely against Ground-type or Electric-type Pokemon.

3. REDIRECTION & SPREAD FAILURES:
   - Rage Powder fails to redirect Grass-type opponents.
   - Protect-type moves (Protect, Detect, Spiky Shield, Wide Guard) fail if chained consecutively.
   - Wide Guard reduces damage of all incoming spread moves to zero. Be aware of Wide Guard active status.

# MANDATORY INSTRUCTIONS:
- Review the provided Primary Draft JSON against the original VGC user request/board state.
- If you find any mechanical error, rule violation, or illegal play (such as the failures/immunities listed above), rewrite the affected sections of the JSON to use legal, optimal plays.
- If the draft is mechanically flawless, approve it as is.
- The output MUST be a JSON object conforming EXACTLY to the same JSON schema requested by the action. Do not add any markdown bolding, explanation, or text outside the JSON.
`;

    const matchDebriefSystemPrompt = `You are a cynical, highly analytical VGC World Champion Coach.
Your ONLY job is to analyze why a match was won or lost based on:
1. The planned playbook we designed.
2. The final match outcome (Won/Lost).
3. The player's post-match observations.

Extract a single, hard-hitting VGC tactical rule/instruction (under 30 words) that we must remember for future matches.
Start the sentence with 'MATCHUP OVERRIDE:'. Example: 'MATCHUP OVERRIDE: Do not lead Pelipper against Abomasnow if they have tailwind pressure.'
Do not use markdown bolding. If the notes are too general or useless to extract a concrete rule, output exactly: NO_RULE`;

    // ── Synergy Scanner Prompt ────────────────────────────────────────────────
    const synergySystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC analyst performing a Synergy Scan on a Regulation MB team roster.
Your task is to identify structural weaknesses, missing roles, and meta vulnerability - before the player ever steps into a match.

Analyze the provided 6-Pokemon roster for:
1. OVERLAPPING TYPE WEAKNESSES: Identify any type that 3 or more Pokemon share as a weakness. Note whether any team member provides an immunity or resist to offset it.
2. MISSING VITAL ROLES: Flag absence of critical roles such as: Speed Control (Tailwind / Trick Room / Icy Wind), Fake Out support, Redirection (Follow Me / Rage Powder), entry hazard control, or significant physical / special split bias.
3. META VULNERABILITY: Identify which top Regulation MB archetypes (Rain, Sun, Sand, Snow, Trick Room, Tailwind Offense, Psyspam) will pose the hardest challenges to this team, and name the exact Pokemon from those archetypes that threaten them.
4. SYNERGY TWEAKS: Suggest up to 3 concrete item, move, or Pokemon swaps that would address the most critical structural hole. Suggestions MUST be drawn exclusively from the STRICT LEGALITY DICTIONARY.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "legality_verification": [
    {"proposed_pokemon": "Every Pokemon you mention in this response", "is_in_strict_dictionary": true}
  ],
  "core_identity": "Brief description of the team archetype and primary win condition.",
  "type_vulnerabilities": ["e.g., 4 Pokemon weak to Ground with no immunity - Excadrill Sand Rush will steamroll this team."],
  "meta_threats": ["e.g., Abomasnow + Alolan Ninetales Snow: Aurora Veil will shut down your offensive output completely."],
  "suggested_tweaks": ["e.g., Replace item X on Pokemon Y with Z to address Ground weakness."],
  "legality_check": true
}`;

    let baseSystemPrompt = action === "optimize" ? optimizeSystemPrompt
      : action === "assess" ? assessSystemPrompt
      : action === "assess_team" ? finalAssessTeamPrompt
      : action === "fetch_meta" ? fetchMetaSystemPrompt
      : action === "turn1" ? turn1SystemPrompt
      : action === "draft_suggestion" ? draftSuggestionSystemPrompt
      : action === "deepdive" ? deepdiveSystemPrompt
      : action === "extract_lesson" ? extractionSystemPrompt
      : action === "match_debrief" ? matchDebriefSystemPrompt
      : action === "synergy" ? synergySystemPrompt
      : auditSystemPrompt;

    if (action === "draft_suggestion" || action === "audit" || action === "turn1" || action === "deepdive") {
      let oppArray = opponent || [];
      if (action === "turn1") {
        oppArray = [...(opponentKnownLeads || []), ...(opponentPotentialBackline || [])];
      }
      
      if (oppArray.length > 0) {
        let detectedArchetype = "Unknown";
        let bestMatchCount = 0;
        
        staticMetaTeams.forEach((archetype: any) => {
          let matchCount = 0;
          oppArray.forEach((p: any) => {
            if (archetype.paste.toLowerCase().includes(p.name.toLowerCase())) {
              matchCount++;
            }
          });
          if (matchCount >= 3 && matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            detectedArchetype = archetype.name;
          }
        });

        let metaProfiles = "";
        oppArray.forEach((p: any) => {
          const normalized = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const match = metaData.pokemon.find((m: any) => m.id === normalized || m.name.toLowerCase() === p.name.toLowerCase());
          if (match && match.role) {
            metaProfiles += `- ${p.name}: Typically runs [${match.topItems.join(', ')}], Tera [${match.topTeras.join(', ')}]. Role: [${match.role}].\n`;
          }
        });

        const metaContextInjection = `\n\n# OPPONENT META DATA (CRITICAL)\n- Archetype Detected: ${detectedArchetype}\n\n${metaProfiles}\nCRITICAL INSTRUCTION: Base your tactical flowchart and damage assessments on the OPPONENT META DATA provided above. Do not guess their items or roles.`;
        baseSystemPrompt += metaContextInjection;
      }
    }

    const finalSystemPrompt = injectSystemRole(baseSystemPrompt, isBeginnerMode === true);

    const userPrompt = action === "optimize"
      ? "Calculate the optimal SP Distribution math distributions for this team.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "assess"
      ? "Analyze this Regulation MB team for meta weaknesses and suggest strong leads.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "fetch_meta"
      ? "Generate 5 distinct, high-level competitive VGC 2026 Regulation MB tournament teams. Return ONLY the JSON object."
      : action === "turn1"
      ? "Turn 1 has begun. Recalculate tactics.\nPlayer Locked Roster: " + JSON.stringify(playerLockedRoster, null, 2) + "\nOpponent Known Leads: " + JSON.stringify(opponentKnownLeads, null, 2) + "\nOpponent Potential Backline: " + JSON.stringify(opponentPotentialBackline, null, 2) + (currentMatchContext ? `\n\nCRITICAL UPDATE: This is Turn 2+. The user has provided the following context for what just happened:\n"${currentMatchContext}"\nRecalculate all tactics based on this new board state.` : "")
      : action === "draft_suggestion"
      ? "Analyze the matchup and suggest 4 Pokemon for the player to bring.\nPlayer Roster: " + JSON.stringify(team, null, 2) + "\nOpponent Roster: " + JSON.stringify(opponent, null, 2)
      : action === "deepdive"
      ? "Deep dive on this 4-Pokemon draft against the Opponent's team.\nOpponent Team: " + JSON.stringify(team, null, 2) + "\nPlayer Draft: " + JSON.stringify(playerLockedRoster, null, 2)
      : action === "assess_team"
      ? "Perform a deep-dive study guide assessment on this Regulation MB team.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "synergy"
      ? "Perform a Synergy Scan on this Regulation MB roster. Identify type weaknesses, missing roles, meta threats, and suggest concrete fixes.\nTeam: " + JSON.stringify(team, null, 2)
      : "Analyze the following team and provide a VGC Audit and Lead Plan.\nTeam: " + JSON.stringify(team, null, 2) + (opponent ? "\nOpponent: " + JSON.stringify(opponent, null, 2) : "");

    const apiKey = process.env.AI_API_KEY;
    let baseUrl = process.env.AI_BASE_URL || "https://api.deepseek.com/v1";
    // Strip trailing /chat/completions to avoid double appending
    baseUrl = baseUrl.replace(/\/chat\/completions\/?$/, "");
    
    const model = process.env.AI_MODEL || process.env.AI_HEAVY_MODEL || "deepseek-chat";

    if (!apiKey) {
      console.warn("No AI_API_KEY found, returning mock data");

      if (action === "extract_lesson") {
        return NextResponse.json({
          message: "MATCHUP OVERRIDE: Do not lead into Intimidate Incineroar without a priority Fake Out or redirection setup in place."
        });
      }

      if (action === "match_debrief") {
        return NextResponse.json({
          message: "MATCHUP OVERRIDE: Do not lead Pelipper when opponents have active Trick Room setters and redirection."
        });
      }

      if (action === "dossier_chat") {
        return NextResponse.json({
          message: "Mock Coach: Intimidate Incineroar is indeed a threat, but Froslass's base speed is significantly higher. If we run Protect, we can stall the Fake Out safely before executing a pivot."
        });
      }

      if (action === "fetch_meta") {
        // Graceful fallback: serve the static JSON so the UI never breaks
        return NextResponse.json(sanitizeResponse({ teams: staticMetaTeams }));
      }

      if (action === "optimize") {
        const mockMons = [
          { id: "incineroar", name: "Incineroar", item: "Sitrus Berry", ability: "Intimidate", nature: "Careful", moves: ["Fake Out", "Flare Blitz", "Parting Shot", "Knock Off"] },
          { id: "froslass", name: "Froslass", item: "Focus Sash", ability: "Cursed Body", nature: "Timid", moves: ["Tailwind", "Shadow Ball", "Blizzard", "Protect"] },
          { id: "pelipper", name: "Pelipper", item: "Damp Rock", ability: "Drizzle", nature: "Modest", moves: ["Hurricane", "Scald", "Tailwind", "Protect"] },
          { id: "lycanrocdusk", name: "Lycanroc-Dusk", item: "Life Orb", ability: "Tough Claws", nature: "Jolly", moves: ["Stone Edge", "Close Combat", "Fire Fang", "Protect"] },
          { id: "kingambit", name: "Kingambit", item: "Black Glasses", ability: "Defiant", nature: "Adamant", moves: ["Kowtow Cleave", "Iron Head", "Sucker Punch", "Protect"] },
          { id: "dragonite", name: "Dragonite", item: "Choice Scarf", ability: "Multiscale", nature: "Adamant", moves: ["Extreme Speed", "Dragon Claw", "Fire Punch", "Superpower"] }
        ];

        const finalOptimized = [...(team || [])];
        const report = [];

        while (finalOptimized.length < 6) {
          const nextMock = mockMons[finalOptimized.length];
          finalOptimized.push(nextMock);
          report.push({
            pokemon: nextMock.name,
            changes: [`Added ${nextMock.name} to complete the meta core.`],
            rationale: `Roster had fewer than 6 Pokemon. Added standard top-tier synergy pick.`
          });
        }

        const formattedTeam = finalOptimized.map((p: any, idx: number) => {
          const matchedMock = mockMons.find(m => m.id === p.id || m.name.toLowerCase() === p.name.toLowerCase()) || mockMons[idx];
          return {
            id: p.id || matchedMock.id,
            name: p.name || matchedMock.name,
            item: p.item || matchedMock.item,
            ability: p.ability || matchedMock.ability,
            nature: p.nature || matchedMock.nature,
            moves: Array.isArray(p.moves) && p.moves.length > 0 ? p.moves : matchedMock.moves,
            sp: p.sp && Object.values(p.sp).some(v => v !== 0) ? p.sp : { hp: 32, atk: 0, def: 4, spa: 0, spd: 4, spe: 26 },
            spExplanations: {
              hp: "Maximized bulk to survive common attacks.",
              spe: "Allocated points to outspeed standard meta threats in Tailwind."
            }
          };
        });

        if (team && team.length > 0) {
          report.unshift({
            pokemon: team[0].name,
            changes: ["Optimized SP Distribution math distribution.", "Set optimal competitive nature & moveset."],
            rationale: "Fitted stat distribution to align with their primary team preview speed-control profile."
          });
        }

        return NextResponse.json({
          optimized_team: formattedTeam,
          optimization_report: report
        });
      }

      if (action === "assess") {
        return NextResponse.json({
          modes: [
            {
              name: "Tailwind Aggro",
              pokemon: ["Pelipper", "Lycanroc-Dusk", "Kingambit", "Dragonite"],
              whenToUse: "Optimal against balanced and slower offensive teams. Use Pelipper to set rain + Tailwind and apply immediate pressure with Swift Swim / high-power attackers."
            },
            {
              name: "Defensive Pivot",
              pokemon: ["Incineroar", "Froslass", "Dragonite", "Kingambit"],
              whenToUse: "Best against hard Trick Room or Hyper Offense. Use Fake Out and Tailwind to mitigate early damage and stall out the opponent's win condition."
            }
          ]
        });
      }

      if (action === "assess_team") {
        const defaultMons = ["Pelipper", "Gholdengo", "Incineroar", "Sinistcha", "Dragonite", "Kingambit"];
        const p1 = team[0]?.name || defaultMons[0];
        const p2 = team[1]?.name || defaultMons[1];
        const p3 = team[2]?.name || defaultMons[2];
        const p4 = team[3]?.name || defaultMons[3];
        const p5 = team[4]?.name || defaultMons[4];
        const p6 = team[5]?.name || defaultMons[5];

        return NextResponse.json({
          legality_verification: [
            { proposed_pokemon: p1, is_in_strict_dictionary: true },
            { proposed_pokemon: p2, is_in_strict_dictionary: true },
            { proposed_pokemon: p3, is_in_strict_dictionary: true },
            { proposed_pokemon: p4, is_in_strict_dictionary: true },
            { proposed_pokemon: p5, is_in_strict_dictionary: true },
            { proposed_pokemon: p6, is_in_strict_dictionary: true }
          ],
          red_flags: ["3 Pokemon are weak to Fire / Flying", "No Protect on a key support slot"],
          team_grades: {
            offense: 80,
            bulk: 75,
            speed_control: 85,
            synergy: 90
          },
          core_identity: "A balanced speed-control core using Tailwind and defensive pivots to position heavy hitters.",
          optimal_cores: [
            {
              core_name: "Tailwind Offense",
              pokemon_lineup: [p1, p2, p3, p4],
              strategy_summary: "Lead speed control + heavy offense. Set Tailwind Turn 1 and apply maximum pressure with high base power attackers before the opponent stabilizes."
            },
            {
              core_name: "Anti-Trick Room",
              pokemon_lineup: [p1, p2, p4, p5],
              strategy_summary: "Bring Fake Out + Taunt to disrupt Trick Room setters. Deny the speed inversion and pivot to your fastest attackers once their win condition is neutralized."
            },
            {
              core_name: "Intimidate Loop",
              pokemon_lineup: [p2, p3, p4, p6],
              strategy_summary: "Cycle Intimidate drops to neuter physical attackers. Use Parting Shot pivots to recycle the attack drop and maintain board control."
            },
            {
              core_name: "Defensive Pivot",
              pokemon_lineup: [p1, p3, p5, p6],
              strategy_summary: "Bring maximum bulk + redirection. Absorb burst damage with redirectors and Protect stalls, then clean up with a single high-powered win condition in the back."
            }
          ],
          meta_matchups: [
            {
              opponent_archetype: "Tailwind Rain (Pelipper / Archaludon / Basculegion)",
              recommended_core: "Tailwind Offense",
              turn_1_plan: `Lead ${p1} + ${p2}. Use Fake Out on Pelipper to stall rain setup, then fire your strongest attack at Archaludon. Do not Protect unless they are locked into a guaranteed OHKO.`,
              play_by_play: {
                turn_1: `Lead ${p1} + ${p2}. Use Fake Out on Pelipper to stall rain setup, then fire your strongest attack at Archaludon. Do not Protect unless they are locked into a guaranteed OHKO.`,
                turn_2: `Follow up on the weakened Archaludon for the KO, and pivot ${p2} out if Basculegion is now free to threaten a Swift Swim sweep.`,
                turn_3: `Bring in your speed control answer to blunt Basculegion's rain-boosted speed before it can clean the back line.`,
                turn_4: "Close out the game by removing Pelipper's replacement and denying any re-established weather."
              },
              win_condition: "Remove Pelipper before they establish weather. Once rain is down, their Swift Swim sweeper becomes a top-priority KO target."
            },
            {
              opponent_archetype: "Hard Trick Room (Indeedee / Hatterene / Torkoal / Ursaluna)",
              recommended_core: "Anti-Trick Room",
              turn_1_plan: `Lead ${p3} + ${p4}. Use Fake Out on Indeedee to stall the Follow Me redirect. Simultaneously Taunt Hatterene to deny Trick Room setup entirely.`,
              play_by_play: {
                turn_1: `Lead ${p3} + ${p4}. Use Fake Out on Indeedee to stall the Follow Me redirect. Simultaneously Taunt Hatterene to deny Trick Room setup entirely.`,
                turn_2: "If Trick Room still goes up, switch to your bulkiest attacker and Protect with the other to scout their new lead.",
                turn_3: "Stall out the remaining Trick Room turns with defensive pivots while chipping the slowest threat.",
                turn_4: "Trick Room expires - your natural speed advantage returns; press the attack immediately."
              },
              win_condition: "If Trick Room is up, switch in your fastest attacker and stall out the turns with Protect. Your speed advantage returns in 4 turns."
            },
            {
              opponent_archetype: "Sun Offense (Torkoal / Lilligant-Hisui / Typhlosion-Hisui / Archaludon)",
              recommended_core: "Tailwind Offense",
              turn_1_plan: `Lead ${p1} + ${p5}. Target Lilligant with a spread move or priority to deny Sleep Powder. Set your own Tailwind to outspeed under sun.`,
              play_by_play: {
                turn_1: `Lead ${p1} + ${p5}. Target Lilligant with a spread move or priority to deny Sleep Powder. Set your own Tailwind to outspeed under sun.`,
                turn_2: "With Tailwind up, target Torkoal directly to remove the weather anchor and shut down sun-boosted damage.",
                turn_3: "Clean up the now-unboosted sun attackers while Tailwind speed advantage still holds.",
                turn_4: "Finish the game before Tailwind expires; re-set only if the opponent has a second sun setter."
              },
              win_condition: "Remove Lilligant immediately - without redirection and Sleep, their sun offense falls apart. Their Torkoal is the weather anchor, target it next."
            },
            {
              opponent_archetype: "Psyspam (Indeedee-F / Hatterene / Gallade / Gholdengo)",
              recommended_core: "Intimidate Loop",
              turn_1_plan: `Lead ${p2} + ${p4}. Psychic Terrain blocks Fake Out - pivot to Intimidate cycling and spread moves instead. Target Gholdengo with dark-type coverage.`,
              play_by_play: {
                turn_1: `Lead ${p2} + ${p4}. Psychic Terrain blocks Fake Out - pivot to Intimidate cycling and spread moves instead. Target Gholdengo with dark-type coverage.`,
                turn_2: "Parting Shot pivot to refresh Intimidate and bring in your dark-type attacker to continue pressuring Gholdengo.",
                turn_3: "Isolate and remove Gholdengo before it stacks further Nasty Plot boosts.",
                turn_4: "With Gholdengo gone, mop up the remaining Psychic Terrain support with spread damage."
              },
              win_condition: "Gholdengo's Can't Be Hit immunity blocks most status. Isolate it with dark-type moves and knock it out before it accumulates Nasty Plot boosts."
            },
            {
              opponent_archetype: "Snow Blizzard (Abomasnow / Alolan Ninetales / Baxcalibur)",
              recommended_core: "Tailwind Offense",
              turn_1_plan: `Lead ${p1} + ${p3}. Fire steel or rock coverage at Alolan Ninetales before Aurora Veil is set. Prioritize the weather setter.`,
              play_by_play: {
                turn_1: `Lead ${p1} + ${p3}. Fire steel or rock coverage at Alolan Ninetales before Aurora Veil is set. Prioritize the weather setter.`,
                turn_2: "With Aurora Veil denied, press forward on Baxcalibur before it can safely set up behind chip damage.",
                turn_3: "Continue trading into Abomasnow to remove the secondary weather source and prevent a re-set.",
                turn_4: "Close out the game with your offensive pressure now that their damage mitigation is gone."
              },
              win_condition: "Deny Aurora Veil on Turn 1. With Veil down, their ice-type damage output is manageable and your offensive pressure wins the endgame."
            },
            {
              opponent_archetype: "Sand Balance (Hippowdon / Excadrill / Gholdengo)",
              recommended_core: "Defensive Pivot",
              turn_1_plan: `Lead ${p5} + ${p6}. Establish Tailwind immediately to nullify Sand Rush. Target Excadrill before sand activates its speed boost.`,
              play_by_play: {
                turn_1: `Lead ${p5} + ${p6}. Establish Tailwind immediately to nullify Sand Rush. Target Excadrill before sand activates its speed boost.`,
                turn_2: "With Excadrill pressured, pivot to your bulkiest attacker to absorb Hippowdon's chip and continue Tailwind uptime.",
                turn_3: "Systematically chip Gholdengo with your redirection support keeping your attackers safe.",
                turn_4: "Close the game once sand offense has no remaining speed-control answer."
              },
              win_condition: "Remove Excadrill early. Without their Sand Rush sweeper, their offense stalls and you can pivot to systematic chip damage - redirection to close."
            }
          ],
          optimizations: [
            {
              target_pokemon: p1,
              suggested_tweak: "Shift 4 SP from HP to Speed to guarantee outspeeding mirrors.",
              rationale: "Ensures speed control goes up first in competitive mirror scenarios."
            }
          ]
        });
      }

      if (action === "synergy") {
        const names = (team || []).map((p: any) => p.name || p.id || "Unknown");
        return NextResponse.json({
          legality_verification: [
            { proposed_pokemon: names[0] || "Unknown", is_in_strict_dictionary: true },
            { proposed_pokemon: names[1] || "Unknown", is_in_strict_dictionary: true },
            { proposed_pokemon: "Incineroar", is_in_strict_dictionary: true }
          ],
          core_identity: `A ${names.length}-Pokemon roster centered around ${names.slice(0, 2).join(" and ")} as the primary offensive core.`,
          type_vulnerabilities: [
            "3+ Pokemon are weak to Ground - Excadrill under Sand Rush will sweep without a Flying type or Levitate user.",
            "No Steel or Poison resist to Fairy-type spread moves - Dazzling Gleam will hit the entire front row."
          ],
          meta_threats: [
            "Rain offense (Pelipper + Basculegion): Swift Swim will outspeed your entire roster without Tailwind or Trick Room.",
            "Psyspam (Indeedee-F + Hatterene): Psychic Terrain will block Fake Out, removing your primary turn-1 tool."
          ],
          suggested_tweaks: [
            "Add Incineroar with Intimidate to patch the physical bulk hole and provide Fake Out support.",
            "Swap an item to Safety Goggles on a back-row member to counter Spore + Rage Powder redirection."
          ],
          legality_check: true
        });
      }

      if (action === "turn1") {
        return NextResponse.json({
          audit: {
            team_identity: "Mid-Match Turn 1 Recalculation",
            preserve_targets: ["Your primary damage dealer"],
            top_findings: "The opponent's known leads dictate immediate defensive switching or Fake Out pressure."
          },
          decision_audit: {
            speed_tier_analysis: "Opponent outspeeds with natural base stats unless we use Tailwind.",
            primary_threat_identified: "Opponent's offensive lead.",
            risk_assessment_justification: "Protecting allows scouting their choice of target without risking a knockout."
          },
          primary_win_condition: {
            path_name: "Optimal Turn 1 Execution",
            leads: ["Your Lead 1", "Your Lead 2"],
            in_the_back: ["Your Back 1", "Your Back 2"],
            turns: [
              {
                "turn_number": 1,
                "player_actions": [
                  { pokemon: "Your Lead 1", action: "Protect", target: "Self", damage_estimation: "None", mechanic_trigger: "Scout" },
                  { pokemon: "Your Lead 2", action: "Pivot", target: "Safe Swap", damage_estimation: "None", mechanic_trigger: "Defensive Rotate" }
                ],
                expected_board_state: "Surviving the initial onslaught.",
                tactical_rationale: "They lead aggressively. Mitigate damage."
              }
            ]
          },
          contingency_plans: []
        });
      }

      if (action === "draft_suggestion") {
        return NextResponse.json({
          suggestedDraft: [team[0]?.name, team[1]?.name, team[2]?.name, team[3]?.name].filter(Boolean),
          suggestedLeads: [team[0]?.name, team[1]?.name].filter(Boolean),
          rationale: "Default safe draft prioritizing balanced typing and speed control."
        });
      }

      if (action === "deepdive") {
        return NextResponse.json({
          draft_justification: "These 4 Pokemon were chosen to create a strong defensive pivot core while maintaining offensive pressure against their primary threats.",
          potential_weaknesses: ["Vulnerable to fast spread damage", "Relies heavily on speed control"],
          things_to_watch_out_for: ["Surprise Choice Scarf users", "Opposing Tailwind", "Unexpected Tera-like abilities (if any)"]
        });
      }

      return NextResponse.json({
        audit: {
          team_identity: "Hyper-Offense Tailwind featuring standard priority and redirection.",
          preserve_targets: ["Lycanroc-Dusk", "Kingambit"],
          top_findings: "Lacks reliable speed control if Pelipper is denied rain setup. Relies heavily on Focus Sash and immediate pressure."
        },
        decision_audit: {
          speed_tier_analysis: "Pelipper sets rain + Tailwind, making Lycanroc-Dusk the fastest physical threat on the board under Swift Swim conditions.",
          primary_threat_identified: "Incineroar's Intimidate and Fake Out threaten our physical offense chain.",
          risk_assessment_justification: "Lycanroc-Dusk's Tough Claws Stone Edge ignores Intimidate via raw base power and hits hard even at -1 Atk."
        },
        primary_win_condition: {
          path_name: "Primary Win Condition: Rain Tailwind Aggro",
          leads: ["Pelipper", "Lycanroc-Dusk"],
          in_the_back: ["Kingambit", "Dragonite"],
          turns: [
            {
              "turn_number": 1,
              "player_actions": [
                { pokemon: "Pelipper", action: "Tailwind", target: "Self", damage_estimation: "None", mechanic_trigger: "Rain + Speed Control" },
                { pokemon: "Lycanroc-Dusk", action: "Stone Edge", target: "Primary Threat", damage_estimation: "High / Potential KO", mechanic_trigger: "Tough Claws Boost" }
              ],
              expected_board_state: "Opponent will likely lead Intimidate Incineroar to neuter Lycanroc-Dusk's physical damage.",
              tactical_rationale: "Pelipper sets rain and Tailwind simultaneously; Lycanroc-Dusk's Tough Claws Stone Edge still deals devastating damage even through an Intimidate drop."
            },
            {
              "turn_number": 2,
              "player_actions": [
                { pokemon: "Pelipper", action: "Hurricane", target: "Weakened Target", damage_estimation: "High Spread Damage", mechanic_trigger: "Rain-boosted 100% accuracy" },
                { pokemon: "Lycanroc-Dusk", action: "Close Combat", target: "Weakened Target", damage_estimation: "Guaranteed KO", mechanic_trigger: "Tough Claws Boost" }
              ],
              expected_board_state: "Opponent is now forced into a defensive posture due to massive speed disadvantage.",
              tactical_rationale: "Capitalize on the speed tier gap to secure a KO before they can pivot to a bulky resist."
            },
            {
              "turn_number": 3,
              "player_actions": [
                { pokemon: "Pelipper", action: "Scald", target: "Opponent", damage_estimation: "Moderate / Burn Chance", mechanic_trigger: "Rain-boosted Burn" },
                { pokemon: "Lycanroc-Dusk", action: "Protect", target: "Self", damage_estimation: "None", mechanic_trigger: "Scout / Stall" }
              ],
              expected_board_state: "Opponent's Trick Room setter attempts to reverse the speed tiers.",
              tactical_rationale: "Scald under rain threatens burns on any incoming bulky pivot; Lycanroc-Dusk scouts behind Protect to preserve HP for the endgame."
            }
          ]
        },
        contingency_plans: [
          {
            path_name: "Vs Hard Trick Room",
            leads: ["Incineroar", "Froslass"],
            in_the_back: ["Lycanroc-Dusk", "Kingambit"],
            turns: [
              {
                "turn_number": 1,
                "player_actions": [
                  { pokemon: "Incineroar", action: "Fake Out", target: "Trick Room Setter", damage_estimation: "Chip Damage", mechanic_trigger: "Flinch & Break Sash" },
                  { pokemon: "Froslass", action: "Tailwind", target: "Self", damage_estimation: "None", mechanic_trigger: "Speed Control" }
                ],
                expected_board_state: "Opponent leads a hard Trick Room setup. Fake Out flinches the setter while Froslass sneaks Tailwind up.",
                tactical_rationale: "Incineroar's Intimidate lowers physical threat; Fake Out flinches the setter before it can move, while Froslass secures Tailwind in the same turn."
              },
              {
                "turn_number": 2,
                "player_actions": [
                  { pokemon: "Incineroar", action: "Parting Shot", target: "Setter", damage_estimation: "None / Debuff", mechanic_trigger: "Pivot + Atk/SpA Drop" },
                  { pokemon: "Froslass", action: "Shadow Ball", target: "Trick Room Setter", damage_estimation: "Moderate / KO attempt", mechanic_trigger: "Ghost coverage" }
                ],
                expected_board_state: "Trick Room is denied; opponent's attacker is debuffed and pressured.",
                tactical_rationale: "Parting Shot pivots Incineroar out to reset Intimidate and bring Lycanroc-Dusk in safely at boosted speed."
              },
              {
                "turn_number": 3,
                "player_actions": [
                  { pokemon: "Lycanroc-Dusk", action: "Stone Edge", target: "Weakened Target", damage_estimation: "High / KO", mechanic_trigger: "Tough Claws Boost" },
                  { pokemon: "Kingambit", action: "Kowtow Cleave", target: "Secondary Threat", damage_estimation: "High", mechanic_trigger: "Never Misses + Dark STAB" }
                ],
                expected_board_state: "Opponent must reposition or suffer heavy damage from Lycanroc-Dusk and Kingambit under Tailwind.",
                tactical_rationale: "With Tailwind up and Trick Room denied, Lycanroc-Dusk and Kingambit clean up at boosted speed."
              }
            ]
          }
        ]
      });
    }

    const dossierChatSystemPrompt = `${REGULATION_MB_CONTEXT}

Provide advanced, highly opinionated, cutthroat tactical insights. Defend your logic, explain your thoughts, or agree to adjust the strategies. Speak with extreme competitive authority.`;

    const builderChatSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a competitive Pokemon VGC Coach assisting the user in brainstorming team strategies and building rosters for Regulation MB.
You can recommend full 6-Pokemon team rosters or discuss strategy.
If the user asks you to build or suggest a team, or if you propose a team roster during the conversation, you MUST generate a complete 6-Pokemon team matching the requested JSON schema.
Ensure that every Pokemon in the team is whitelisted and legal according to the whitelisted legal species and forms.

# SP Distribution Math Engine Constraints
1. The SP (Stat Point) system uses a strict maximum of 66 total SP per Pokemon.
2. The total sum of SP across HP, atk, def, spa, spd, and spe MUST EXACTLY EQUAL 66.
3. NO individual stat can exceed 32 SP. (0 is the minimum).

You MUST return ONLY valid JSON matching this exact schema:
{
  "message": "Conversational coach text explaining the strategy...",
  "team": [
    {
      "id": "lowercase_id",
      "name": "Pokemon Name",
      "item": "Held Item",
      "ability": "Ability",
      "nature": "Nature",
      "moves": ["Move 1", "Move 2", "Move 3", "Move 4"],
      "sp": { "hp": 0, "atk": 0, "def": 0, "spa": 0, "spd": 0, "spe": 0 }
    }
  ],
  "strategy": "Summary of the team's core strategy..."
}

Note: If you are NOT suggesting a team (e.g. you are answering a general strategy question or explaining mechanics), you MUST set "team" and "strategy" to null.
Remember, you are strictly forbidden from using emojis, emoticons, or special unicode characters in the "message" or "strategy". Use pure, plain ASCII text only.`;

    const extractDossierSystemPrompt = `${REGULATION_MB_CONTEXT}

Analyze the following chat transcript between a Challenger and a VGC Coach.
Your job is to harvest and structure any actionable data that emerged during the discussion.

Extract:
1. extracted_team: If the coach discussed or recommended team modifications (items, SP spreads, moves, abilities, natures), reconstruct the final optimized 6-man roster reflecting all agreed changes. Use the original team as the base and apply every modification mentioned. If no team changes were discussed, set this to null.
2. extracted_tactic: If a specific matchup strategy or game plan was debated, formalize it as a tactical playbook entry. If no specific tactic was discussed, set this to null.

You MUST return ONLY valid JSON with this exact schema:
{
  "extracted_team": [
    { "id": "string", "name": "string", "item": "string", "ability": "string", "nature": "string", "moves": ["string"], "sp": { "hp": 0, "atk": 0, "def": 0, "spa": 0, "spd": 0, "spe": 0 } }
  ],
  "extracted_tactic": {
    "title": "e.g., Mega Golurk TR vs Tailwind Rain",
    "matchup_summary": "string",
    "primary_win_condition": { "core_strategy": "string", "lead_pairing": "string" },
    "turn_by_turn": [ { "turn_number": 1, "player_actions": ["string"], "expected_board_state": "string" } ]
  }
}

Note: extracted_team and extracted_tactic may each be null if no relevant data was found in that category.`;

    let finalMessages = [];
    if (action === "dossier_chat") {
      finalMessages = [
        { role: "system", content: dossierChatSystemPrompt },
        ...(messages || []).map((msg: any) => ({ role: msg.role, content: msg.content }))
      ];
    } else if (action === "builder_chat") {
      // DeepSeek json_object mode requires the word "json" in at least one user message.
      // We append a silent suffix to the last user turn to satisfy this constraint.
      const rawMsgs = (messages || []).map((msg: any) => ({ role: msg.role as string, content: msg.content as string }));
      if (rawMsgs.length > 0) {
        const lastIdx = rawMsgs.length - 1;
        if (rawMsgs[lastIdx].role === "user") {
          rawMsgs[lastIdx] = {
            ...rawMsgs[lastIdx],
            content: rawMsgs[lastIdx].content + "\n\nRespond in JSON format."
          };
        }
      }
      finalMessages = [
        { role: "system", content: builderChatSystemPrompt },
        ...rawMsgs
      ];
    } else if (action === "extract_lesson") {
      // Pass the raw chat log as a single user message for the extractor to parse
      finalMessages = [
        { role: "system", content: extractionSystemPrompt },
        { role: "user", content: "Extract the strategic rule from this coaching chat log:\n\n" + JSON.stringify(messages || [], null, 2) }
      ];
    } else if (action === "extract_dossier") {
      finalMessages = [
        { role: "system", content: injectSystemRole(extractDossierSystemPrompt, isBeginnerMode ?? false) },
        { role: "user", content: `Extract actionable insights from this coaching session.\n\nOriginal Team:\n${JSON.stringify(team, null, 2)}\n\nChat Transcript:\n${JSON.stringify(messages || [], null, 2)}` }
      ];
    } else if (action === "match_debrief") {
      finalMessages = [
        { role: "system", content: matchDebriefSystemPrompt },
        { role: "user", content: `Review this match outcome and observations:
Playbook Designed: ${JSON.stringify(body.playbook || {}, null, 2)}
Match Outcome: ${body.outcome}
Player Observations: ${body.notes}

Extract the single tactical rule.` }
      ];
    } else {
      finalMessages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userPrompt }
      ];
    }

    // Step 1: The Primary Draft
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: finalMessages,
        response_format: (action === "dossier_chat" || action === "extract_lesson" || action === "match_debrief") ? undefined : { type: "json_object" },
        temperature: (action === "assess_team" || action === "dossier_chat" || action === "synergy" || action === "builder_chat") ? 0.5 : (action === "extract_lesson" || action === "match_debrief") ? 0.1 : action === "extract_dossier" ? 0.1 : 0.2
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "(unreadable)");
      console.error(`[coach] API error ${response.status} for action=${action}:`, errBody);
      throw new Error(`API returned ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    if (action === "dossier_chat" || action === "extract_lesson" || action === "match_debrief") {
      return NextResponse.json({ message: content });
    }

    if (action === "builder_chat") {
      content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
      const sanitized = content.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitized);
      return NextResponse.json(sanitizeResponse(parsed));
    }

    if (action === "extract_dossier") {
      content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
      const sanitized = content.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitized);
      return NextResponse.json(sanitizeResponse(parsed));
    }

    if (action === "draft_suggestion" || action === "turn1" || action === "deepdive") {
      content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
      const sanitizedResponse = content.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitizedResponse);
      return NextResponse.json(sanitizeResponse(parsed));
    }

    if (action === "synergy") {
      content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
      const sanitizedSynergy = content.replace(/,\s*([\]}])/g, '$1');
      const parsedSynergy = JSON.parse(sanitizedSynergy);
      return NextResponse.json(sanitizeResponse(parsedSynergy));
    }

    // Step 2: The Red Team Critic
    const primaryDraft = content;
    let finalContent = primaryDraft;

    try {
      const criticUserPrompt = `Here is the original user request / board state:\n${userPrompt}\n\nHere is the Primary Draft playbook generated:\n${primaryDraft}\n\nAnalyze this draft, correct any mechanical errors, and output the final validated JSON object matching the requested schema.`;
      
      const criticMessages = [
        { role: "system", content: criticSystemPrompt },
        { role: "user", content: criticUserPrompt }
      ];

      const criticResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
          model: model,
          messages: criticMessages,
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (criticResponse.ok) {
        const criticData = await criticResponse.json();
        const criticContent = criticData.choices[0].message.content;
        
        // Sanity check: verify the Critic's output is parseable JSON
        const cleanedCriticContent = criticContent.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
        const sanitizedCritic = cleanedCriticContent.replace(/,\s*([\]}])/g, '$1');
        JSON.parse(sanitizedCritic); // If invalid JSON, throws and triggers catch
        
        finalContent = criticContent;
      } else {
        console.warn(`[Critic AI] Failed with status ${criticResponse.status}. Falling back to primary draft.`);
      }
    } catch (criticError) {
      console.error("[Critic AI] Error during validation/correction loop. Falling back to primary draft:", criticError);
    }

    content = finalContent;

    content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
    
    // Strip trailing commas before closing braces or brackets (common LLM hallucination)
    const sanitizedResponse = content.replace(/,\s*([\]}])/g, '$1');
    const parsed = JSON.parse(sanitizedResponse);
    return NextResponse.json(sanitizeResponse(parsed));

  } catch (error) {
    console.error("Coach API Error:", error);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}

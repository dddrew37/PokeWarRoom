import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import staticMetaTeams from '../../../data/meta_teams.json';
import metaData from '../../../data/meta_data.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, opponent, action = "audit", playerLockedRoster, opponentKnownLeads, opponentPotentialBackline, currentMatchContext, dossier, messages, chatContext, isBeginnerMode } = body;

    if (!team && !playerLockedRoster && action !== "fetch_meta" && action !== "extract_lesson" && action !== "match_debrief") {
      return NextResponse.json({ error: 'Team data is required' }, { status: 400 });
    }

    // ── RAG: Fetch active user-defined directives from Supabase ─────────────────
    // Only injected into actions that produce tactical playbook/planning output.
    let userDirectivesContext = "";
    const RAG_ACTIONS = ["turn1", "deepdive", "assess_team", "draft_suggestion"];
    if (RAG_ACTIONS.includes(action)) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data: tactics, error: tacticsError } = await supabase
            .from('ai_learned_tactics')
            .select('rule_text')
            .eq('is_active', true);
          if (!tacticsError && tactics && tactics.length > 0) {
            userDirectivesContext = tactics
              .map((t: { rule_text: string }, i: number) => `${i + 1}. ${t.rule_text}`)
              .join('\n');
          }
        } catch (ragErr) {
          // Non-fatal — a failed directive fetch must never block the main AI call.
          console.warn('[Coach API] RAG directive fetch failed (non-fatal):', ragErr);
        }
      }
    }

    // ── Build REGULATION_MB_CONTEXT (with optional RAG directive injection) ─────
    let REGULATION_MB_CONTEXT = `
# REGULATION M-B & 2026 META CONTEXT (CRITICAL ENFORCEMENT)
- You are evaluating teams for the VGC 2026 Regulation M-B format (Pokémon Champions).
- STRICT ROSTER ADHERENCE: You MUST carefully read the exact team roster provided. Analyze every single Item, SP Stat spread, Move, Nature, and Ability. Do NOT assume a Pokémon is running a standard meta set; base all your tactical advice ONLY on the exact data provided in the user's payload.
- TERASTALLIZATION IS STRICTLY BANNED. Do not ever suggest Terastallizing a Pokémon.
- Z-MOVES AND DYNAMAX ARE STRICTLY BANNED.
- MEGA EVOLUTION IS LEGAL: Assume holding a Mega Stone means Turn 1 Mega Evolution. You must actively check the provided roster's items for Mega Stones and factor their exact Mega Evolution stats/abilities into your calculations.
- GEN 7+ SPEED MECHANICS: A Mega-Evolved Pokémon uses its NEW Speed stat on the exact turn it Mega Evolves.
- CUSTOM 66-SP MATH: All stats use the 66-SP (Stat Point) system (Max 32 SP per stat). Do not use 510-EV math.
- ANTI-HALLUCINATION: Do not invent items, moves, or mechanics. Base all calculations on strict Generation 9 core mechanics paired with Mega Evolutions.
- FORMATTING RESTRICTION: You must keep your text formatting extremely clean. DO NOT use markdown bolding (**text**) to emphasize words. Do not use excessive headers. Use plain text paragraphs, clean spacing, and simple bullet points only. Let your words carry the weight, not the formatting.
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

You are an expert VGC analyst with knowledge of the current Pokémon VGC 2026 Regulation M-B competitive landscape.
Your task is to output exactly 5 distinct, high-level competitive tournament teams that are currently strong in the Regulation M-B format.
Regulation M-B includes Mega Evolutions and the latest Pokémon series up to the current date.

Each team MUST contain EXACTLY 6 Pokémon entries written in Pokémon Showdown import format (also called PokePaste).
Separate each Pokémon block with exactly TWO blank lines (\n\n).
Each block MUST include: Species @ Item, Ability, Nature, and at least 2 moves prefixed with \"- \".

You MUST output ONLY a raw JSON object. Do NOT add any commentary, markdown, or explanatory text.
The JSON object MUST match this exact schema:
{
  "teams": [
    {
      "name": "Descriptive team archetype name (e.g. Tailwind Rain, Hard Trick Room)",
      "paste": "Full 6-Pokémon PokePaste text with double-newline separators"
    }
  ]
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const optimizeSystemPrompt = `${REGULATION_MB_CONTEXT}

You are an expert Pokemon VGC Teambuilder. Your task is to calculate optimal 66-SP math distributions for the provided team based on their competitive roles (e.g. fast screen setter, unburden aggro, late-game nuke, bulk).

# 66-SP Math Engine Constraints
1. The SP (Stat Point) system uses a strict maximum of 66 total SP per Pokemon.
2. The total sum of SP across HP, atk, def, spa, spd, and spe MUST EXACTLY EQUAL 66.
3. NO individual stat can exceed 32 SP. (0 is the minimum).
4. Standard 252 EVs map exactly to 32 SP. 4 EVs map to 2 SP.

Analyze the team's species, items, abilities, natures, and moves to determine their optimal roles and output their perfect 66-SP spreads. For every stat that has an SP allocation greater than 0, you must provide a 1-sentence educational explanation in the explanations object.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "optimized_team": [
    { 
      "id": "pokemon_id_here",
      "sp": { "hp": 0, "atk": 32, "def": 0, "spa": 0, "spd": 2, "spe": 32 },
      "explanations": {
        "atk": "Maximized to secure critical physical KOs.",
        "spd": "Remaining 2 points allocated to Special Defense to survive specs attacks.",
        "spe": "Maximized to outspeed default base 100 speed tiers."
      }
    }
  ]
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const assessSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach analyzing a Regulation M-B team.
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
- You know exactly which 4 Pokémon the player brought.
- You know exactly which 2 Pokémon the opponent led with.
- The opponent has 4 Potential Backline Pokémon (only 2 of them were brought, but you don't know which 2).

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
- \`primary_threat_identified\`: Which opponent Pokémon poses the immediate highest risk.
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
Your task is to analyze the Player's 6-man roster and the Opponent's 6-man roster, and suggest exactly 4 Pokémon for the player to bring into the match.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "suggestedDraft": ["Pokemon A", "Pokemon B", "Pokemon C", "Pokemon D"],
  "suggestedLeads": ["Pokemon A", "Pokemon B"],
  "rationale": "A brief explanation of why these 4 Pokémon optimally counter the opponent's composition, and why those 2 are the best leads."
}`;

    const deepdiveSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach. The player has selected a specific 4-Pokémon draft to face the Opponent's 6-man team in Regulation M-B.
Your task is to analyze this draft and provide a deep dive explanation.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "draft_justification": "Detailed explanation of why these specific 4 Pokémon are the optimal response to the opponent's roster.",
  "potential_weaknesses": ["String 1", "String 2", "String 3"],
  "things_to_watch_out_for": ["Threat 1", "Threat 2", "Threat 3"]
}`;

    const assessTeamSystemPrompt = `${REGULATION_MB_CONTEXT}

TONE DIRECTIVE: Speak with the absolute authority and extreme tactical depth of a World Champion. DO NOT give generic, beginner-level advice. Be highly opinionated, cite specific meta threats by name, and provide advanced, cutthroat VGC strategies.

You are a World Champion VGC Coach performing a deep-dive "Study Guide" assessment of a Regulation M-B team.
Your task is to analyze the team's core identity, suggested lineups, threat matrix, and optimizations based on their composition.

You MUST base your entire analysis on the specific 66-SP distributions, items, abilities, and movesets provided in the roster. Do not give generic advice. If a Pokémon has 32 Speed SP, explain how that exact speed tier dictates their gameplan. Keep explanations deeply detailed but extremely easy to understand (jargon-free).

If the user is in Beginner Mode, you must scan the team for glaring structural weaknesses (e.g., '4 Pokémon are weak to Ground', 'Zero Protects on the team', 'No Speed Control'). Output 1 to 3 severe warnings in the red_flags array. If the team is structurally sound, or if Beginner Mode is disabled, leave the array empty.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "red_flags": ["Glaring teambuilding warning 1", "Glaring teambuilding warning 2"],
  "core_identity": "Detailed description of the team's archetype and overall win condition.",
  "suggested_lineups": [
    {
      "lineup_name": "Example: Fast Rain Offense",
      "front_line": ["Pokemon A", "Pokemon B"],
      "back_line": ["Pokemon C", "Pokemon D"],
      "strategy_explanation": "A detailed but easy-to-understand explanation of why these 4 Pokémon are chosen, how their specific SP spreads/items synergize, and what the win condition is."
    }
  ],
  "threat_matrix": {
    "favorable_matchups": ["Favorable matchup scenario 1", "Favorable matchup scenario 2"],
    "critical_vulnerabilities": ["Critical vulnerability 1", "Critical vulnerability 2"]
  },
  "optimizations": [
    {
      "target_pokemon": "Pokemon Name",
      "suggested_tweak": "Suggested move, item, or 66-SP point redistribution.",
      "rationale": "Why this tweak improves the team's synergy and matchups."
    }
  ],
  "detailed_tactics": [
    {
      "scenario_name": "Scenario name (e.g. Vs. Archaludon Rain, Vs. Hard Trick Room). Create 3-4 distinct scenarios.",
      "key_interactions": "Details on key Pokemon interactions and type advantages in this matchup.",
      "execution_steps": [
        "Turn 1 details...",
        "Turn 2 details...",
        "Turn 3 details..."
      ]
    }
  ]
}`;

    let finalAssessTeamPrompt = assessTeamSystemPrompt;
    if (action === "assess_team" && chatContext && chatContext.length > 0) {
      finalAssessTeamPrompt += `\n\nCRITICAL OVERRIDE: The user has debated this roster with you. You MUST read the provided chat history and strictly update the primary modes, threat matrix, and detailed tactics to reflect the final agreements reached in the chat.\nChat history:\n${JSON.stringify(chatContext, null, 2)}`;
    }

    const extractionSystemPrompt = `You are a highly analytical VGC data parser. Your ONLY job is to read a chat log between a player and a World Champion Coach and extract the definitive strategic rule or contingency they agreed upon. Output ONLY the rule as a single, commanding sentence. Start the sentence with 'MATCHUP OVERRIDE:'. Example: 'MATCHUP OVERRIDE: Do not lead Mega Sceptile against Rain/Kyogre cores.' Do not use markdown bolding. If the chat is just general banter and no specific rule was agreed upon, output exactly the string: NO_RULE`;

    const criticSystemPrompt = `
# CRITIC PERSONA:
You are a cynical, mathematically flawless VGC World Champion. Your only job is to review the Primary Draft VGC strategy/playbook and aggressively correct any game-losing mechanical errors, rule violations, or illegal plays under Regulation M-B.

${REGULATION_MB_CONTEXT}

# CRITICAL VGC MECHANICS GUARDRAILS:
1. PRIORITY FAILURES:
   - Fake Out and Prankster-boosted moves fail completely against active Psychic Terrain.
   - Fake Out and Prankster-boosted moves fail completely against targets with Armor Tail or Queenly Majesty.
   - Fake Out fails against Inner Focus targets (they do not flinch).
   - Fake Out and First Impression ONLY work on the absolute first turn a Pokémon is on the field.

2. TYPE & ITEM IMMUNITIES:
   - Spore, Rage Powder, and other powder-based moves have zero effect against Grass-type Pokémon or Pokémon holding Safety Goggles.
   - Prankster Taunt and other Prankster-boosted status moves fail completely against Dark-type Pokémon.
   - Thunder Wave fails completely against Ground-type or Electric-type Pokémon.

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
Start the sentence with 'MATCHUP OVERRIDE:'. Example: 'MATCHUP OVERRIDE: Do not lead Tornadus against Regieleki if they have tailwind pressure.'
Do not use markdown bolding. If the notes are too general or useless to extract a concrete rule, output exactly: NO_RULE`;

    let finalSystemPrompt = action === "optimize" ? optimizeSystemPrompt
      : action === "assess" ? assessSystemPrompt
      : action === "assess_team" ? finalAssessTeamPrompt
      : action === "fetch_meta" ? fetchMetaSystemPrompt
      : action === "turn1" ? turn1SystemPrompt
      : action === "draft_suggestion" ? draftSuggestionSystemPrompt
      : action === "deepdive" ? deepdiveSystemPrompt
      : action === "extract_lesson" ? extractionSystemPrompt
      : action === "match_debrief" ? matchDebriefSystemPrompt
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
        finalSystemPrompt += metaContextInjection;
      }
    }

    if (isBeginnerMode === true) {
      finalSystemPrompt += `\n\nBEGINNER MODE ACTIVE: You are coaching a brand new VGC player. You MUST explain your strategy without assuming they know competitive jargon. If you use terms like 'Speed Control', 'Pivoting', 'STAB', 'Check', 'Counter', 'Redirection', or 'Stat Drops', you MUST briefly define what they mean and why they are important in plain English. Example: Instead of saying 'Use Parting Shot to pivot,' say 'Use Parting Shot to safely switch out your Pokémon while lowering the opponent's attacking stats (a strategy called pivoting).'`;
    }

    const userPrompt = action === "optimize"
      ? "Calculate the optimal 66-SP distributions for this team.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "assess"
      ? "Analyze this Regulation M-B team for meta weaknesses and suggest strong leads.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "fetch_meta"
      ? "Generate 5 distinct, high-level competitive VGC 2026 Regulation M-B tournament teams. Return ONLY the JSON object."
      : action === "turn1"
      ? "Turn 1 has begun. Recalculate tactics.\nPlayer Locked Roster: " + JSON.stringify(playerLockedRoster, null, 2) + "\nOpponent Known Leads: " + JSON.stringify(opponentKnownLeads, null, 2) + "\nOpponent Potential Backline: " + JSON.stringify(opponentPotentialBackline, null, 2) + (currentMatchContext ? `\n\nCRITICAL UPDATE: This is Turn 2+. The user has provided the following context for what just happened:\n"${currentMatchContext}"\nRecalculate all tactics based on this new board state.` : "")
      : action === "draft_suggestion"
      ? "Analyze the matchup and suggest 4 Pokémon for the player to bring.\nPlayer Roster: " + JSON.stringify(team, null, 2) + "\nOpponent Roster: " + JSON.stringify(opponent, null, 2)
      : action === "deepdive"
      ? "Deep dive on this 4-Pokémon draft against the Opponent's team.\nOpponent Team: " + JSON.stringify(team, null, 2) + "\nPlayer Draft: " + JSON.stringify(playerLockedRoster, null, 2)
      : action === "assess_team"
      ? "Perform a deep-dive study guide assessment on this Regulation M-B team.\nTeam: " + JSON.stringify(team, null, 2)
      : "Analyze the following team and provide a VGC Audit and Lead Plan.\nTeam: " + JSON.stringify(team, null, 2) + (opponent ? "\nOpponent: " + JSON.stringify(opponent, null, 2) : "");

    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL || "https://api.deepseek.com/v1";
    
    let model = "";
    if (action === "assess_team" || action === "dossier_chat") {
      model = process.env.AI_HEAVY_MODEL || "deepseek-chat";
    } else {
      model = process.env.AI_MODEL || "deepseek-v4-flash";
    }

    if (!apiKey) {
      console.warn("No AI_API_KEY found, returning mock data");

      if (action === "extract_lesson") {
        return NextResponse.json({
          message: "MATCHUP OVERRIDE: Do not lead into Intimidate Incineroar without a priority Fake Out or redirection setup in place."
        });
      }

      if (action === "match_debrief") {
        return NextResponse.json({
          message: "MATCHUP OVERRIDE: Do not lead Tornadus when opponents have active Trick Room setters and redirection."
        });
      }

      if (action === "dossier_chat") {
        return NextResponse.json({
          message: "Mock Coach: Intimidate Incineroar is indeed a threat, but Froslass's base speed is significantly higher. If we run Protect, we can stall the Fake Out safely before executing a pivot."
        });
      }

      if (action === "fetch_meta") {
        // Graceful fallback: serve the static JSON so the UI never breaks
        return NextResponse.json({ teams: staticMetaTeams });
      }

      if (action === "optimize") {
        return NextResponse.json({
          optimized_team: team.map((p: any) => ({
            id: p.id,
            sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 },
            explanations: {
              atk: "Maximized physical attack to maximize damage output of critical hits.",
              spd: "Allocated remaining 2 points to bolster Special Defense against priority moves.",
              spe: "Maximized speed to outspeed other base 110 physical attackers in Tailwind."
            }
          }))
        });
      }

      if (action === "assess") {
        return NextResponse.json({
          modes: [
            {
              name: "Tailwind Aggro",
              pokemon: ["Tornadus", "Urshifu", "Flutter Mane", "Raging Bolt"],
              whenToUse: "Optimal against balanced and slower offensive teams. Use Tornadus to set Tailwind and apply immediate pressure."
            },
            {
              name: "Defensive Pivot",
              pokemon: ["Incineroar", "Amoonguss", "Raging Bolt", "Urshifu"],
              whenToUse: "Best against hard Trick Room or Hyper Offense. Use Fake Out and Spore to mitigate early damage and stall out opponent's conditions."
            }
          ]
        });
      }

      if (action === "assess_team") {
        return NextResponse.json({
          red_flags: ["3 Pokémon are weak to Electric", "Zero Protects detected on Amoonguss"],
          core_identity: "A hybrid speed-control team utilizing Tailwind and hard-hitting physical attackers to establish early-game board control.",
          suggested_lineups: [
            {
              lineup_name: "Tailwind Hyper Offense",
              front_line: [team[0]?.name || "Tornadus", team[1]?.name || "Urshifu"],
              back_line: [team[4]?.name || "Flutter Mane", team[5]?.name || "Raging Bolt"],
              strategy_explanation: "Lead with Tornadus and Urshifu to set immediate Tailwind control. Urshifu's 32 Speed SP lets it outspeed common checks in Tailwind to secure fast KOs, while Flutter Mane sweeps from the back line."
            },
            {
              lineup_name: "Defensive Control Mode",
              front_line: [team[2]?.name || "Incineroar", team[3]?.name || "Amoonguss"],
              back_line: [team[1]?.name || "Urshifu", team[5]?.name || "Raging Bolt"],
              strategy_explanation: "Lead Incineroar and Amoonguss to rotate Intimidate and use Spore to disrupt opponent leads. The passive bulk combined with 32 HP SP allows safe pivoting to bring in sweepers."
            },
            {
              lineup_name: "Trick Room Denial",
              front_line: [team[0]?.name || "Tornadus", team[2]?.name || "Incineroar"],
              back_line: [team[3]?.name || "Amoonguss", team[5]?.name || "Raging Bolt"],
              strategy_explanation: "Lead Tornadus and Incineroar to disrupt Trick Room setup. Incineroar uses Fake Out, and Tornadus uses Taunt to shut down status moves, pivoting to Amoonguss to stall turns."
            }
          ],
          threat_matrix: {
            favorable_matchups: [
              "Balanced teams that cannot match our Tailwind speed control.",
              "Rain-based weather cores that we can pressure with redirection."
            ],
            critical_vulnerabilities: [
              "Hard Trick Room teams that bypass our speed control.",
              "Special attackers that bypass Intimidate drops."
            ]
          },
          optimizations: [
            {
              target_pokemon: team[0]?.name || "Tornadus",
              suggested_tweak: "Shift 4 SP from HP to Speed to guarantee outspeeding opposing base 110s.",
              rationale: "Ensures we get Tailwind up first in mirrors."
            }
          ],
          detailed_tactics: [
            {
              scenario_name: "Vs. Archaludon Rain",
              key_interactions: "Use Amoonguss and Urshifu to pivot against Pelipper and check Archaludon.",
              execution_steps: [
                "Turn 1: Lead with Tornadus to set Tailwind immediately. Use Urshifu to attack Pelipper to deny Tailwind setup.",
                "Turn 2: Pivot Tornadus to Amoonguss on an expected Electro Shot from Archaludon.",
                "Turn 3: Utilize Rage Powder redirection to allow Urshifu to land a critical Close Combat on Archaludon."
              ]
            },
            {
              scenario_name: "Vs. Hard Trick Room",
              key_interactions: "Mitigate early sweeps using Incineroar Fake Out and Amoonguss Spore.",
              execution_steps: [
                "Turn 1: Lead Incineroar. Fake Out the Trick Room setter while Amoonguss uses Spore on the offensive threat.",
                "Turn 2: Parting Shot with Incineroar to lower stats and bring in Urshifu.",
                "Turn 3: Use Amoonguss to put the setter to sleep once Trick Room is finally set to stall out TR turns."
              ]
            }
          ]
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
          draft_justification: "These 4 Pokémon were chosen to create a strong defensive pivot core while maintaining offensive pressure against their primary threats.",
          potential_weaknesses: ["Vulnerable to fast spread damage", "Relies heavily on speed control"],
          things_to_watch_out_for: ["Surprise Choice Scarf users", "Opposing Tailwind", "Unexpected Tera-like abilities (if any)"]
        });
      }

      return NextResponse.json({
        audit: {
          team_identity: "Hyper-Offense Tailwind featuring standard priority and redirection.",
          preserve_targets: ["Urshifu", "Flutter Mane"],
          top_findings: "Lacks reliable speed control if Tornadus is denied setup. Relies heavily on Focus Sash and immediate pressure."
        },
        decision_audit: {
          speed_tier_analysis: "Tornadus guarantees we move first with Prankster Tailwind, making Urshifu the fastest threat on the board.",
          primary_threat_identified: "Incineroar's Intimidate and Fake Out threaten our setup.",
          risk_assessment_justification: "Ignoring Intimidate with Surging Strikes is optimal to remove early pressure."
        },
        primary_win_condition: {
          path_name: "Primary Win Condition: Tailwind Aggro",
          leads: ["Tornadus", "Urshifu"],
          in_the_back: ["Flutter Mane", "Raging Bolt"],
          turns: [
            {
              "turn_number": 1,
              "player_actions": [
                { pokemon: "Tornadus", action: "Tailwind", target: "Self", damage_estimation: "None", mechanic_trigger: "Prankster Speed Control" },
                { pokemon: "Urshifu", action: "Surging Strikes", target: "Threat", damage_estimation: "High / Potential KO", mechanic_trigger: "Bypasses Intimidate & Protect" }
              ],
              expected_board_state: "Opponent will likely lead Intimidate Incineroar to neuter Urshifu's physical damage.",
              tactical_rationale: "Tornadus uses Prankster Tailwind to guarantee speed advantage, while Surging Strikes ignores Intimidate drops via guaranteed crits."
            },
            {
              "turn_number": 2,
              "player_actions": [
                { pokemon: "Tornadus", action: "Bleakwind Storm", target: "Both", damage_estimation: "Spread Chip Damage", mechanic_trigger: "Potential Speed Drop" },
                { pokemon: "Urshifu", action: "Close Combat", target: "Weakened Target", damage_estimation: "Guaranteed KO", mechanic_trigger: "Defensive Drop" }
              ],
              expected_board_state: "Opponent is now forced into a defensive posture due to massive speed disadvantage.",
              tactical_rationale: "Capitalize on the speed tier gap to secure a KO before they can pivot to a bulky resist."
            },
            {
              "turn_number": 3,
              "player_actions": [
                { pokemon: "Tornadus", action: "U-turn", target: "Opponent", damage_estimation: "Minimal Chip", mechanic_trigger: "Safe Pivot" },
                { pokemon: "Urshifu", action: "Protect", target: "Self", damage_estimation: "None", mechanic_trigger: "Scout / Stall" }
              ],
              expected_board_state: "Opponent's Trick Room setter attempts to reverse the speed tiers.",
              tactical_rationale: "Safely pivot out Tornadus to bring in Flutter Mane's special offense while preserving Urshifu behind Protect."
            }
          ]
        },
        contingency_plans: [
          {
            path_name: "Vs Hard Trick Room",
            leads: ["Incineroar", "Amoonguss"],
            in_the_back: ["Urshifu", "Raging Bolt"],
            turns: [
              {
                "turn_number": 1,
                "player_actions": [
                  { pokemon: "Incineroar", action: "Fake Out", target: "Trick Room Setter", damage_estimation: "Chip Damage", mechanic_trigger: "Flinch & Break Sash" },
                  { pokemon: "Amoonguss", action: "Spore", target: "Attacker", damage_estimation: "None", mechanic_trigger: "Sleep Status" }
                ],
                expected_board_state: "Opponent leads a hard Trick Room setup with Follow Me support.",
                tactical_rationale: "Incineroar's Intimidate lowers physical threat, while Fake Out bypasses Follow Me redirection to flinch the setter."
              },
              {
                "turn_number": 2,
                "player_actions": [
                  { pokemon: "Incineroar", action: "U-turn", target: "Setter", damage_estimation: "Chip Damage", mechanic_trigger: "Pivot to Sweeper" },
                  { pokemon: "Amoonguss", action: "Pollen Puff", target: "Incineroar", damage_estimation: "Healing", mechanic_trigger: "Restore HP" }
                ],
                expected_board_state: "Trick Room is prevented, and opponent's physical attacker is asleep.",
                tactical_rationale: "Pivot Incineroar out to reset Intimidate for late game, while healing him with Pollen Puff."
              },
              {
                "turn_number": 3,
                "player_actions": [
                  { pokemon: "Urshifu", action: "Surging Strikes", target: "Awake Target", damage_estimation: "High / KO", mechanic_trigger: "Ignore Stat Drops" },
                  { pokemon: "Amoonguss", action: "Rage Powder", target: "Self", damage_estimation: "None", mechanic_trigger: "Redirection" }
                ],
                expected_board_state: "Opponent must reposition or suffer heavy damage from the fresh Urshifu.",
                tactical_rationale: "Amoonguss uses Rage Powder redirection to absorb all attacks, ensuring Urshifu survives to sweep."
              }
            ]
          }
        ]
      });
    }

    const dossierChatSystemPrompt = `${REGULATION_MB_CONTEXT}

You are a World Champion VGC Coach engaging in a tactical debate/chat with a user about their Regulation M-B team.
The team's current roster: ${JSON.stringify(team, null, 2)}
The current Roster Study Dossier: ${JSON.stringify(dossier, null, 2)}
 
Provide advanced, highly opinionated, cutthroat tactical insights. Defend your logic, explain your thoughts, or agree to adjust the strategies. Speak with extreme competitive authority.`;

    let finalMessages = [];
    if (action === "dossier_chat") {
      finalMessages = [
        { role: "system", content: dossierChatSystemPrompt },
        ...(messages || []).map((msg: any) => ({ role: msg.role, content: msg.content }))
      ];
    } else if (action === "extract_lesson") {
      // Pass the raw chat log as a single user message for the extractor to parse
      finalMessages = [
        { role: "system", content: extractionSystemPrompt },
        { role: "user", content: "Extract the strategic rule from this coaching chat log:\n\n" + JSON.stringify(messages || [], null, 2) }
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
        temperature: (action === "assess_team" || action === "dossier_chat") ? 0.5 : (action === "extract_lesson" || action === "match_debrief") ? 0.1 : 0.2
      })
    });

    if (!response.ok) {
      throw new Error("API returned " + response.status);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    if (action === "dossier_chat" || action === "extract_lesson" || action === "match_debrief") {
      return NextResponse.json({ message: content });
    }

    if (action === "draft_suggestion" || action === "turn1" || action === "deepdive") {
      content = content.replace(/^\s*```json/i, '').replace(/```\s*$/i, '').trim();
      const sanitizedResponse = content.replace(/,\s*([\]}])/g, '$1');
      const parsed = JSON.parse(sanitizedResponse);
      return NextResponse.json(parsed);
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
    return NextResponse.json(parsed);

  } catch (error) {
    console.error("Coach API Error:", error);
    return NextResponse.json({ error: "Failed to generate AI response" }, { status: 500 });
  }
}

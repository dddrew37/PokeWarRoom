import { NextResponse } from 'next/server';
import staticMetaTeams from '../../../data/meta_teams.json';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { team, opponent, action = "audit", playerLockedRoster, opponentKnownLeads, opponentPotentialBackline, currentMatchContext } = body;

    if (!team && !playerLockedRoster && action !== "fetch_meta") {
      return NextResponse.json({ error: 'Team data is required' }, { status: 400 });
    }

    const auditSystemPrompt = `You are a Pokemon VGC Coach. Perform a findings-first competitive audit and turn the team into real opening plans instead of fake full-game scripts.



# REGULATION M-B & 2026 META CONTEXT (CRITICAL)

- You are evaluating teams for the VGC 2026 Regulation M-B format.

- Mega Evolutions are LEGAL and highly centralizing to the meta.

- Factor in standard Regulation M-B threats and updated mechanics. Treat any provided Pokémon, Items, or Moves as fully legal for this format. Do not question their legality; evaluate their tactical viability.



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



# VGC DOUBLES SCHEMA REQUIREMENT

This is a VGC Doubles format. Every turn MUST have exactly 2 player actions. You MUST explicitly name the 2 Leads and the 2 In The Back for each path.



You must output your response STRICTLY as a JSON object matching this schema so the frontend can render branching flowcharts:

{
  "audit": {
    "team_identity": "Brief summary of what the team wants to establish early.",
    "preserve_targets": ["Pokemon Name"],
    "top_findings": "Highest impact structural observations."
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

    const fetchMetaSystemPrompt = `You are an expert VGC analyst with knowledge of the current Pokémon VGC 2026 Regulation M-B competitive landscape.
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

    const optimizeSystemPrompt = `You are an expert Pokemon VGC Teambuilder. Your task is to calculate optimal 66-SP math distributions for the provided team based on their competitive roles (e.g. fast screen setter, unburden aggro, late-game nuke, bulk).

# 66-SP Math Engine Constraints
1. The SP (Stat Point) system uses a strict maximum of 66 total SP per Pokemon.
2. The total sum of SP across HP, atk, def, spa, spd, and spe MUST EXACTLY EQUAL 66.
3. NO individual stat can exceed 32 SP. (0 is the minimum).
4. Standard 252 EVs map exactly to 32 SP. 4 EVs map to 2 SP.

Analyze the team's species, items, abilities, natures, and moves to determine their optimal roles and output their perfect 66-SP spreads.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "optimized_team": [
    { 
      "id": "pokemon_id_here",
      "sp": { "hp": 0, "atk": 32, "def": 0, "spa": 0, "spd": 2, "spe": 32 } 
    }
  ]
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const assessSystemPrompt = `You are a World Champion VGC Coach analyzing a Regulation M-B team.
Identify structural vulnerabilities and recommend strong opening leads based on the team's composition.

You must output your response STRICTLY as a JSON object matching this schema:
{
  "weaknesses": ["String explaining a specific meta vulnerability (e.g., weak to Rain, weak to Trick Room)"],
  "suggested_leads": [{"pair": "Pokemon A + Pokemon B", "reason": "Why this is a strong opening"}],
  "overall_verdict": "A brief 2-sentence summary of the team's viability."
}
Do NOT wrap the JSON in Markdown (e.g. \`\`\`json). Output RAW JSON only.`;

    const turn1SystemPrompt = `You are a World Champion VGC Coach sitting in the War Room mid-match. Turn 1 has started.

# REGULATION M-B & 2026 META CONTEXT (CRITICAL)
- You are evaluating for the VGC 2026 Regulation M-B format. Mega Evolutions are LEGAL.

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

You must output your response STRICTLY as a JSON object matching this schema:
{
  "audit": {
    "team_identity": "Matchup analysis of the opening board state.",
    "preserve_targets": ["Crucial Pokemon to keep alive against their backline"],
    "top_findings": "Immediate Turn 1 tactical threats and positioning advantages."
  },
  "primary_win_condition": {
    "path_name": "Optimal Turn 1 Execution",
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
      "path_name": "Conservative Defensive Pivot",
      "leads": ["Player Lead 1", "Player Lead 2"],
      "in_the_back": ["Player Back 1", "Player Back 2"],
      "turns": []
    }
  ]
}
Do NOT wrap the JSON in Markdown. Output RAW JSON only.`;

    const systemPrompt = action === "optimize" ? optimizeSystemPrompt
      : action === "assess" ? assessSystemPrompt
      : action === "fetch_meta" ? fetchMetaSystemPrompt
      : action === "turn1" ? turn1SystemPrompt
      : auditSystemPrompt;
    const userPrompt = action === "optimize"
      ? "Calculate the optimal 66-SP distributions for this team.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "assess"
      ? "Analyze this Regulation M-B team for meta weaknesses and suggest strong leads.\nTeam: " + JSON.stringify(team, null, 2)
      : action === "fetch_meta"
      ? "Generate 5 distinct, high-level competitive VGC 2026 Regulation M-B tournament teams. Return ONLY the JSON object."
      : action === "turn1"
      ? "Turn 1 has begun. Recalculate tactics.\nPlayer Locked Roster: " + JSON.stringify(playerLockedRoster, null, 2) + "\nOpponent Known Leads: " + JSON.stringify(opponentKnownLeads, null, 2) + "\nOpponent Potential Backline: " + JSON.stringify(opponentPotentialBackline, null, 2) + (currentMatchContext ? `\n\nCRITICAL UPDATE: This is Turn 2+. The user has provided the following context for what just happened:\n"${currentMatchContext}"\nRecalculate all tactics based on this new board state.` : "")
      : "Analyze the following team and provide a VGC Audit and Lead Plan.\nTeam: " + JSON.stringify(team, null, 2) + (opponent ? "\nOpponent: " + JSON.stringify(opponent, null, 2) : "");

    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      console.warn("No AI_API_KEY found, returning mock data");

      if (action === "fetch_meta") {
        // Graceful fallback: serve the static JSON so the UI never breaks
        return NextResponse.json({ teams: staticMetaTeams });
      }

      if (action === "optimize") {
        return NextResponse.json({
          optimized_team: team.map((p: any) => ({
            id: p.id,
            sp: { hp: 0, atk: 32, def: 0, spa: 0, spd: 2, spe: 32 }
          }))
        });
      }

      if (action === "assess") {
        return NextResponse.json({
          weaknesses: [
            "Extremely vulnerable to Trick Room setups without a dedicated counter or priority Taunt.",
            "Lacks reliable speed control outside of a single Tailwind user.",
            "Weak to Wide Guard spam against double spread moves."
          ],
          suggested_leads: [
            { pair: "Tornadus + Urshifu", reason: "Standard aggressive Tailwind opening that threatens immediate KOs." },
            { pair: "Incineroar + Amoonguss", reason: "Defensive pivot lead to scout and put threats to sleep." }
          ],
          overall_verdict: "This is a strong Hyper-Offense core that relies on early momentum. However, it requires careful pivoting against hard Trick Room to maintain control."
        });
      }

      if (action === "turn1") {
        return NextResponse.json({
          audit: {
            team_identity: "Mid-Match Turn 1 Recalculation",
            preserve_targets: ["Your primary damage dealer"],
            top_findings: "The opponent's known leads dictate immediate defensive switching or Fake Out pressure."
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

      return NextResponse.json({
        audit: {
          team_identity: "Hyper-Offense Tailwind featuring standard priority and redirection.",
          preserve_targets: ["Urshifu", "Flutter Mane"],
          top_findings: "Lacks reliable speed control if Tornadus is denied setup. Relies heavily on Focus Sash and immediate pressure."
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

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error("API returned " + response.status);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

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

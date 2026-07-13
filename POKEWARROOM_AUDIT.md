# PokeWarRoom — Comprehensive Codebase & Architecture Audit

> **Audit Date:** 2026-07-13 | **Format:** VGC 2026 Regulation M-B (Pokémon Champions)  
> **Scope:** Full read-only traversal of `src/`, `scripts/`, and configuration layer.  
> **Status:** Production-Ready Architecture with Identified Technical Debt

---

## 1. Executive Summary

**PokeWarRoom** is a specialized, offline-first competitive Pokémon VGC coaching terminal built as a Progressive Web Application (PWA). Its purpose is to eliminate the need for multiple external tools (Pokémon Showdown calc, external team builders, paper notes) by consolidating team building, AI-powered battle planning, real-time speed/damage calculation, and strategy persistence into a single cohesive application.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 15** (App Router, `"use client"` components) |
| Styling | **Tailwind CSS v4** |
| Fonts | **Geist Sans + Geist Mono** (Google Fonts via next/font) |
| Backend | **Next.js API Routes** (serverless edge-compatible handlers) |
| AI Layer | **DeepSeek API** (configurable via `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`) |
| Persistence | **Supabase** (optional — conditionally initialized; gracefully disabled if env vars absent) |
| PWA | **@ducanh2912/next-pwa** (service worker, offline support, installable) |
| Data | **Static JSON database** (`src/data/meta_data.json`) built from PokeAPI via offline scraper scripts |
| Build Tools | **Turbopack** (enabled via `turbopack: {}` in `next.config.ts`) |
| Type Checking | **TypeScript** (strict, with `npx tsc --noEmit` gate) |

### Major Modules

1. **Team Forge** — Manual/paste-based team builder with AI SP optimizer and Deep Dive Dossier.
2. **Live Logger (War Room)** — Real-time match coaching terminal with Speed Board, Damage Calculator, and AI-generated flowcharts.
3. **Roster Dossier** — Standalone paste-import team analyst with chat-based tactical sparring.
4. **Saved Books** — Supabase-backed library of persisted playbooks and dossier assessments.
5. **Math Engines** — Isolated TypeScript libraries for speed and damage calculation.
6. **AI/Backend Layer** — Fully prompt-routed API handler with Regulation M-B enforcement context.
7. **Data Layer** — Self-hosted offline database built via PokeAPI scrapers with a strict format banlist.

---

## 2. Architectural Breakdown

### 2.1 UI/UX Layer

#### `src/app/page.tsx` — Application Shell
- Acts as a thin, client-rendered tab router with four states: `"forge"`, `"logger"`, `"dossier"`, `"saved"`.
- Global state is minimal and correct: only `teamState` (the player's active team) is lifted to this level and passed as a prop to `TeamForge` and `TeamPreviewLogger`.
- **Hydration Safety:** The `"use client"` directive is present. `useState` initial values are all primitives or empty arrays — no mismatch risk between server and client render.
- **Assessment:** Clean architecture. The shell correctly prevents unnecessary prop drilling by keeping battle-specific state local to the consuming components.

---

#### `src/components/TeamForge.tsx` — Team Builder (989 lines)
- Handles: paste import, manual build, AI SP optimization (`/api/coach?action=optimize`), Deep Dive Dossier, Dossier sparring chat, Supabase save/load, meta team loader, and PokePaste export.
- **State:** 13+ `useState` hooks. The component is accumulating significant complexity.
- **Supabase:** Correctly gates all Supabase calls with `if (!supabase) return;` — no uncaught null reference risk.
- **AI Deep Dive:** Correctly passes `chatContext` only as an array — the `Array.isArray()` guard prevents accidental `React.MouseEvent` forwarding.
- **Assessment:** Functional but approaching the limit of single-component complexity. See Technical Debt §4.2.

---

#### `src/components/TeamPreviewLogger.tsx` — Live Logger / War Room (747 lines)
- The most complex component. Manages: opponent roster selection, Turn 1 state machine (`"pregame"` / `"turn1"`), AI draft suggestions, deepdive, and full match modifier state.
- **Match Modifier State (verified complete):**
  - `isTrickRoom` — Trick Room toggle.
  - `playerTailwind` / `opponentTailwind` — Side-specific Tailwind.
  - `weather` — String enum: `"none"`, `"rain"`, `"sun"`.
  - `speedStages` — Per-slot speed stage record (`p-0`, `p-1`, `o-0`, `o-1`).
  - `choiceScarfs` — Per-slot Choice Scarf toggles.
  - `opponentMaxSpeeds` — Per-opponent slot max-speed override.
- **Reset on Back:** `handleResetMatchModifiers()` correctly clears all live modifier state when returning to Team Preview.
- **Prop Passing to DamageCalculator:** Correctly passes all 4 locked player Pokémon and the full 6-mon opponent roster.
- **Assessment:** The `matchPhase` state machine is correct, but the component mixes UI rendering with AI orchestration. See Technical Debt §4.1.

---

#### `src/components/SpeedBoard.tsx` — Speed Turn-Order Visualizer (289 lines)
- **Engine Integration:** Imports `determineTurnOrder`, `lookupBaseSpeed`, and `BattleFieldState` directly from `src/lib/speed.ts`. No UI logic bleeds into the engine.
- **66-SP Conversion (verified):** `speEvs = p.sp?.spe !== undefined ? p.sp.spe * 8 : 0` — correctly converts 66-SP units to raw EVs for the stat formula.
- **Nature Resolution:** Maps Jolly/Timid/Naive/Hasty → 1.1x; Brave/Relaxed/Quiet/Sassy → 0.9x. Covers the standard speed-affecting natures.
- **Trick Room:** Passes `isTrickRoom` into each `BattleFieldState` and into `determineTurnOrder`. The engine handles the sort direction reversal internally.
- **Tailwind:** Correctly passes side-specific tailwind flags (`playerTailwind` for `p-x` slots, `opponentTailwind` for `o-x` slots).
- **Animations:** Card positions are computed as `left: ${position * (cardWidth + gapWidth)}px` CSS values with `transition-all duration-500 ease-in-out` on a `position: absolute` flex container — smooth order-change animations.
- **Assessment:** Excellent isolation and clean data flow. A reference implementation for the pattern.

---

#### `src/components/DamageCalculator.tsx` — Live Damage Sidebar (15KB)
- **Engine Integration:** Imports `calculateDamage`, `lookupBaseStats`, and `DamageModifiers` from `src/lib/damage.ts`.
- **Inputs available:** Attacker (player), Defender (opponent), Base Power, Category (Physical/Special), Type Effectiveness (x0, x0.25, x0.5, x1, x2, x4), STAB toggle, Attacker Item (Life Orb 1.3x, Choice Band/Specs 1.5x), Defender Max Stats toggle, Attack Stage, Defense Stage.
- **Output Display:** Renders `minPercent% - maxPercent%` in large font with a progress bar visual and a glowing animated "Guaranteed OHKO" badge on guaranteed OHKO.
- **Auto-Correction:** `useEffect` guards correct index drift when team sizes change.
- **Assessment:** Solid. Note the legacy `src/utils/damageCalc.ts` still exists — see Technical Debt §4.3.

---

#### `src/components/LivePlaybook.tsx` — Battle Flowchart Renderer (468 lines)
- Renders the AI-generated branching flowchart: primary win condition + contingency plans.
- **Schema Adherence:** TypeScript interfaces `PlaybookData`, `FlowchartNode`, `DoubleTurnNode`, and `PlayerAction` precisely mirror the JSON schema enforced in `route.ts`.
- **Backwards Compatibility:** `matchup_condition` and `flowcharts` fallback fields preserved for old Supabase-saved strategies.
- **Supabase Save:** Save flow is correctly wrapped in `supabase && supabase.from("saved_strategies")` guard.

---

#### `src/components/RosterDossier.tsx` — Standalone Study Tool (351 lines)
- Standalone paste-import tool for team analysis and AI chat sparring.
- **SP Detection:** `isClosedSheet` flag detects when a team was pasted without SP values (all-zero spreads) and surfaces an optimization prompt.
- **Chat History Reset:** `setMessages([])` on successful re-import correctly prevents cross-contamination of chat context.
- **Markdown Renderer:** Custom `renderMarkdown()` function handles `#`/`##`/`###` headers, `- ` bullet points, and `**bold**` inline spans. Simple but effective for the output format.

---

#### `src/components/SavedStrategies.tsx` — Library (348 lines)
- Dual-tab layout: Saved Playbooks (`saved_strategies`) and Saved Dossiers (`saved_teams` where `assessment_data IS NOT NULL`).
- **Supabase Guard:** `if (!supabase) { setLoading(false); return; }` — gracefully handles missing Supabase config.
- **Error Handling:** Errors are surface via `console.error` + `alert()`. Functional for V1, but `alert()` is a UX anti-pattern that blocks the main thread.

---

### 2.2 The Math Engines

#### `src/lib/speed.ts` — Speed Calculation Engine (349 lines)

**Isolation:** ✅ Pure TypeScript. No React imports. No UI state dependencies. Zero side effects.

**Interface Summary:**
- `VGCStats` — 6-stat structure (hp, atk, def, spa, spd, spe).
- `MatchModifiers` — Full modifier set: tailwind, scarf, stat stage, weather, ability, item, Mega triggers.
- `BattleFieldState` — Dual-purpose: single Pokémon state or global environment wrapper (supports `activePokemon?: BattleFieldState[]`).

**Key Functions:**
- `getMegaBaseSpeed(pokemonName, item)` — Inline lookup table mapping Mega Stones to their Mega form Speed base stats. Turn 1 Mega rule enforcement is handled here.
- `lookupBaseSpeed(name)` — Resolves base Speed from `meta_data.json`. Graceful fallback to `75` on miss.
- `calculateModifiedSpeed(baseSpeed, modifiers)` — Full Gen 9 Speed formula: Level 50 stat derivation → stat stage → tailwind → item → ability (Swift Swim, Chlorophyll, Sand Rush, Slush Rush, Surge Surfer, Unburden, Slow Start, Quick Feet).
- `determineTurnOrder(activePokemon)` — Accepts array or wrapper object. Maps all active slots, calculates modified speeds, sorts ascending or descending based on `isTrickRoom`.

**66-SP Compliance (verified):** Speed EVs are derived from `sp.spe * 8` when the SP structure is present. EV fallback also supported.

**Assessment:** This engine is exemplary. It is fully isolated, deterministically testable, and correctly handles all Regulation M-B speed mechanics including Turn 1 Mega Evolution.

---

#### `src/lib/damage.ts` — Damage Calculation Engine (236 lines)

**Isolation:** ✅ Pure TypeScript. No React imports.

**Key Functions:**
- `convertSPToEV(sp)` — Custom 66-SP formula: `EV = (SP - 1) * 8 + 4` (if SP > 0), else 0. **Verified unit-tested.**
- `calculateLevel50Stat(base, sp, natureModifier, isHP)` — Standard Gen 9 Level 50 formula with 31 IV assumption.
- `getNatureModifier(nature, statName)` — Full nature table (4 stats, +/- natures).
- `lookupBaseStats(name)` — Resolves from `meta_data.json`. Fallback to 100 across all stats on miss.
- `calculateDamage(attacker, defender, power, category, modifiers)` — Full formula: `((22 * Power * Attack / Defense) / 50) + 2`. Applies min roll (x0.85) and max roll (x1.0). STAB (1.5x), Type Effectiveness (0 to 4x), Life Orb (1.3x), Choice Band/Specs (1.5x), stat stages (-6 to +6). Returns `isGuaranteedOHKO`.

**Assessment:** Clean, correct, and test-verified. One note: the `attackerMaxStats` toggle (252 EV / positive nature assumption for opponent) is the expected behavior for opponent-side calculations.

---

#### `src/utils/damageCalc.ts` — Legacy Damage Util (139 lines)

> [!WARNING]
> This is a **legacy file** that predates `src/lib/damage.ts`. It contains a parallel (and inferior) implementation: no SP math, no item boosts, and the `koChance` field is a string enum instead of a boolean. `DamageCalculator.tsx` has been migrated to use `src/lib/damage.ts`, but `damageCalc.ts` remains imported by nothing as dead code. **This file should be scheduled for removal.**

---

### 2.3 The AI/Backend Layer

#### `src/app/api/coach/route.ts` — AI Routing Hub (706 lines)

**Structural Integrity:** ✅ Excellent.

**REGULATION_MB_CONTEXT Injection (verified present and complete):**
```
TERASTALLIZATION IS STRICTLY BANNED.
Z-MOVES AND DYNAMAX ARE STRICTLY BANNED.
MEGA EVOLUTION IS LEGAL: Assume holding a Mega Stone means Turn 1 Mega Evolution.
GEN 7+ SPEED MECHANICS: A Mega-Evolved Pokémon uses its NEW Speed stat on the exact turn it Mega Evolves.
CUSTOM 66-SP MATH: All stats use the 66-SP (Stat Point) system (Max 32 SP per stat).
ANTI-HALLUCINATION: Do not invent items, moves, or mechanics.
```
This context string is prepended to **every** system prompt via string interpolation (`${REGULATION_MB_CONTEXT}`). This guarantees format-law enforcement across all 8 action modes.

**Prompt Routing System (8 modes, verified):**

| Action | Prompt | Response Schema |
|---|---|---|
| `audit` | VGC Team Audit & Lead Planner | `PlaybookData` JSON |
| `optimize` | 66-SP Math Optimizer | `{ optimized_team: [...] }` |
| `assess` | Mode Identifier | `{ modes: [...] }` |
| `assess_team` | Deep Dive Study Guide | `{ core_identity, primary_modes, threat_matrix, optimizations, detailed_tactics }` |
| `fetch_meta` | Meta Team Generator | `{ teams: [...] }` |
| `turn1` | Turn 1 Recalculation | `PlaybookData` JSON |
| `draft_suggestion` | Team Preview Advisor | `{ suggestedDraft, suggestedLeads, rationale }` |
| `deepdive` | Draft Deep Dive | `{ draft_justification, potential_weaknesses, things_to_watch_out_for }` |
| `dossier_chat` | Tactical Sparring Chat | `{ message: string }` |

**Meta Archetype Detection:** For `audit`, `draft_suggestion`, `turn1`, and `deepdive`, the route performs an offline archetype match against `staticMetaTeams` (≥3 Pokémon overlap = archetype detected) and injects `OPPONENT META DATA` into the system prompt. This is a strong feature that grounds AI tactical advice without a second API call.

**Model Tiering (verified):**
- `assess_team` and `dossier_chat` use `AI_HEAVY_MODEL` (more capable/costly).
- All other actions use `AI_MODEL` (faster/cheaper).

**JSON Sanitization (verified):** A trailing comma stripper regex `content.replace(/,\s*([\]}])/g, '$1')` protects against the most common LLM JSON hallucination. The response format is locked to `{ type: "json_object" }` for all non-chat actions.

**Graceful Fallback:** All 8 action modes have hardcoded mock responses returned when `AI_API_KEY` is absent. Development and testing require zero API credits.

**Error Handling:** `try/catch` wraps the entire handler. `console.error` + `500` status on any exception. HTTP non-2xx AI responses throw explicitly.

---

#### `src/app/api/ladder-teams/route.ts` — Live Tournament Scraper (179 lines)

- Scrapes Limitless TCG for the most recent completed VGC tournament.
- **3-layer defensive fallback:** if tournament ID not found → if no player slugs → if 0 valid pastes → all fall back to `staticMetaTeams` with a `source: 'fallback'` flag in the response body.
- **Concurrent Fetching:** `Promise.allSettled()` (not `Promise.all()`) ensures that a single failed player paste fetch doesn't break the entire operation.
- **Validation:** Paste sanity check (`paste.toLowerCase().includes('ability:')`) before acceptance.
- **Assessment:** Defensive and production-safe. The `User-Agent` header is correctly set to avoid bot blocking.

---

### 2.4 The Data Layer

#### `src/data/meta_data.json` — Core Offline Database
- Built by `scripts/sync-db.js` (preferred) or `scripts/update-meta.js` (legacy, missing `id` field).
- Contains: Pokémon array (id, name, types, baseStats, abilities, moves), `legal_items`, `legal_moves`.
- **Usage:** Imported statically at module load time by `speed.ts`, `damage.ts`, `damageCalc.ts`, `pokemon.ts`, and `parser.ts`.

#### `scripts/sync-db.js` — Primary Database Syncer (169 lines)
**Banlist Logic (verified strictly correct):**
- **Keyword exclusion:** All restricted Legendary, Mythical, Paradox Pokémon, and Gholdengo are explicitly enumerated.
- **Form exclusions:** `-mega`, `-gmax`, `-totem`, `-starter`, `-cosplay` suffixes are excluded (Mega forms are handled at team preview time, not in the database).
- **Regional form handling:** Alolan, Galarian, Hisuian, Paldean forms are formatted with correct prefix naming (`Alolan Vulpix`, etc.).
- **The `iron-` prefix ban:** A subtle but important catch that excludes all Iron series Paradox Pokémon via substring matching.
- **Batch size:** 50 Pokémon per batch with a 1-second retry delay — defensive against PokeAPI rate limiting.

#### `scripts/update-meta.js` — Legacy Syncer
- A slightly older version of `sync-db.js` that omits the `id` field from the Pokémon object. Since `pokemon.ts` and `parser.ts` depend on `p.id` for sprite URL generation and database matching, this script is functionally inferior and should be deprecated.

#### `scripts/sync-meta-teams.js` — Static Meta Team Seed (1091 lines)
- A hardcoded seed script generating `src/data/meta_teams.json` with tournament-representative team pastes for Regulation M-B.
- Used as the AI context injector and fallback when the Limitless scraper fails.
- **Assessment:** Accurate as of the 2026 M-B meta. Will require periodic manual updates as the metagame evolves.

#### `src/lib/parser.ts` — PokePaste Parser (194 lines)
- **Dual-format detection:** Detects whether paste is Showdown (double newline) or Limitless (triple+ newline) format automatically.
- **Input sanitization:** Normalizes `\u00A0` (non-breaking spaces), tabs, and invisible whitespace before parsing. Collapses 3+ blank lines to 2.
- **SP auto-detection (critical):** If `rawSum ≤ 66 && allStatsAtMost32`, the parser treats the EV field as already being in 66-SP format and back-converts to standard EVs. Otherwise it converts standard EVs to SP. This allows importing both standard Showdown pastes and 66-SP formatted pastes.
- **Name normalization:** Matches against `meta_data.json` using alphanumeric-only comparison — handles hyphens and capitalization variants.

#### `src/lib/pokemon.ts` — Pokemon Roster Builder (31 lines)
- Maps all `meta_data.json` entries to `Pokemon[]` for UI dropdowns.
- Showdown sprite URL pattern: `https://play.pokemonshowdown.com/sprites/gen5/{id}.png`.
- Inline SVG Pokéball fallback for broken sprite graceful degradation.

---

## 3. Security & State Evaluation

### 3.1 Environment Variables

| Variable | Visibility | Assessment |
|---|---|---|
| `AI_API_KEY` | `process.env` (server-side only) | ✅ Safe — never exposed to client |
| `AI_BASE_URL` | `process.env` (server-side only) | ✅ Safe |
| `AI_MODEL` / `AI_HEAVY_MODEL` | `process.env` (server-side only) | ✅ Safe |
| `NEXT_PUBLIC_SUPABASE_URL` | `process.env.NEXT_PUBLIC_*` | ⚠️ Public by design — standard Supabase pattern. Acceptable as the anon key is row-level security scoped, but requires RLS configured in Supabase dashboard. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `process.env.NEXT_PUBLIC_*` | ⚠️ Same as above — must be paired with Supabase Row Level Security policies to prevent unauthorized data access. |

> [!IMPORTANT]
> **`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are intentionally public** as per the Supabase client pattern, but the audit notes that **Row Level Security (RLS) policies MUST be configured** in the Supabase dashboard to prevent any user from reading or writing another user's saved strategies. This audit cannot verify RLS configuration, which is external to the codebase.

### 3.2 Error Handling

| Location | Pattern | Status |
|---|---|---|
| `route.ts` | `try/catch` around entire handler, returns `{ error }` + 500 | ✅ Correct |
| `ladder-teams/route.ts` | 3-layer fallback + `Promise.allSettled()` | ✅ Excellent |
| `supabase.ts` | Conditional init — `supabase` is `null` if env vars absent | ✅ Correct |
| `SavedStrategies.tsx` | `supabase` null-guard before all queries | ✅ Correct |
| `parser.ts` | Returns empty `team[]` on block parse fail, does not throw | ✅ Safe |
| `TeamForge.tsx` | `try/catch` around AI calls, `alert()` on failure | ⚠️ `alert()` is synchronous and blocks UI |

### 3.3 React Hydration Desync Protections

- All interactive components use `"use client"` directive correctly.
- `useState` initial values are primitives or empty arrays — no `Date.now()`, `Math.random()`, or server-only data in initial state.
- `layout.tsx` renders a static `<html>` + `<body>` shell only — no dynamic values during SSR.
- `metaPokemon` from `pokemon.ts` is a static module-level constant derived from a static JSON import — consistent between server and client.
- **Assessment:** No hydration desync risk identified.

---

## 4. Technical Debt & Future Roadmap

### 4.1 🔴 HIGH PRIORITY: `TeamPreviewLogger.tsx` and `TeamForge.tsx` Decomposition

Both are over-large components (747 and 989 lines respectively) that mix AI orchestration logic, network calls, and rendering. The components violate the Single Responsibility Principle.

**Recommendation:** Extract custom hooks for AI operations:
- `useCoachAI(action, payload)` — shared hook wrapping `/api/coach` POST with loading/error state.
- `useSupabaseTeams()` — Supabase save/load abstraction for `TeamForge`.
- `useMatchModifiers()` — Bundle the 6 modifier states and `handleReset` into a single hook for `TeamPreviewLogger`.

This would reduce both component rendering trees to under 300 lines of pure JSX.

---

### 4.2 🟡 MEDIUM PRIORITY: Dead Code Removal — `src/utils/damageCalc.ts`

The legacy `src/utils/damageCalc.ts` is no longer imported by any component. `DamageCalculator.tsx` has been fully migrated to `src/lib/damage.ts`.

**Recommendation (Next Sprint):**
1. Confirm via `grep -r "damageCalc"` that no remaining imports exist.
2. Delete `src/utils/damageCalc.ts`.
3. Consider whether `calculateStats()` from `damageCalc.ts` should be re-implemented in `src/lib/damage.ts` if a future feature requires full-team stat previews.

---

### 4.3 🟡 MEDIUM PRIORITY: `type: any` Elimination in AI Response Handling

Several components use `useState<any>` for AI response data:
- `TeamForge.tsx`: `dossierData: any`, `savedTeams: any[]`
- `SavedStrategies.tsx`: `strategies: any[]`, `selected: any`
- `TeamPreviewLogger.tsx`: `playbookData: any`

The `PlaybookData`, `FlowchartNode`, and `DoubleTurnNode` interfaces are already defined in `LivePlaybook.tsx`.

**Recommendation (Next Sprint):**
1. Export `PlaybookData`, `FlowchartNode` from `LivePlaybook.tsx` or move them to a shared `src/types/playbook.ts`.
2. Create `AssessTeamData`, `DraftSuggestionData`, and `DossierData` interfaces matching the exact JSON schemas in `route.ts`.
3. Replace all `any` usages in state declarations with the typed interfaces.

This eliminates an entire class of potential runtime crashes from API schema mismatches.

---

### 4.4 🟢 LOW PRIORITY: Performance — `meta_data.json` Import Strategy

`meta_data.json` is statically imported at module level in 5 separate files: `speed.ts`, `damage.ts`, `damageCalc.ts`, `pokemon.ts`, and `parser.ts`. Next.js bundles these as separate module instances but the underlying data object is the same.

**Recommendation (Future Sprint):**
- Create a `src/lib/database.ts` singleton that loads and exports `metaData` once.
- All consumers import from this singleton rather than directly from JSON.
- This reduces bundle duplication and allows for future dynamic JSON loading (e.g., loading meta data from a CDN in production).

---

## 5. Summary Scorecard

| Category | Score | Notes |
|---|---|---|
| Math Engine Isolation | ✅ Excellent | Zero UI coupling. Deterministically testable. |
| AI Prompt Architecture | ✅ Excellent | REGULATION_MB_CONTEXT injected universally. 8 well-scoped action modes. |
| Data Layer Integrity | ✅ Strong | Banlist is accurate, parser handles dual format, fallback chains are complete. |
| Security Posture | ✅ Good | API key server-gated. Supabase pattern is standard but requires RLS verification. |
| Component Architecture | ⚠️ Needs Refactoring | Two oversized components accumulating too many responsibilities. |
| Type Safety | ⚠️ Partial | Core libs are typed. AI response state uses `any` throughout. |
| Dead Code | ⚠️ 1 file | `src/utils/damageCalc.ts` — safely removable. |
| PWA/Offline | ✅ Good | Service worker enabled, static JSON offline, Supabase gracefully disabled. |

---

*Audit produced by PokeWarRoom AI Guardrails (read-only, no source files modified).*

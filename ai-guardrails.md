CRITICAL SYSTEM GUARDRAILS - DO NOT IGNORE

Before executing any task, you must strictly adhere to the following rules to prevent regression in the VGC War Room app:



1. ZERO DESTRUCTIVE REWRITES: Never delete or overwrite existing architectural safety nets. The JSON sanitization regex in `route.ts`, the legacy save fallback hook in `LivePlaybook.tsx`, and the 66-SP math conversion logic (252 EV = 32 SP) are permanent. Do not touch them unless explicitly instructed.

2. DEFENSIVE PARSING: When writing or updating string parsing logic (RegEx, string splitting), assume the input will be messy. Always account for varying line breaks (`\r\n` vs `\n`), inconsistent capitalization, and extra whitespace. Never let a failed parse crash the app; always provide a safe default state (e.g., defaulting an EV to 0 without throwing an error).

3. STRICT TYPE PRESERVATION: Do not change existing TypeScript interfaces unless adding new optional properties. If you add a new data field, you must safely check for its existence in the UI (e.g., `turn.damage_estimation && ...`) to prevent `undefined` render crashes on legacy data.

4. ADDITIVE UI ONLY: When adding new buttons, tabs, or components, do not remove existing layout wrappers. Ensure React 18 state batching is respected to prevent render race conditions.
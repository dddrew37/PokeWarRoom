"use client";

import Link from "next/link";

export default function UserManual() {
  const faqs = [
    {
      q: "1. What is PokeWarRoom?",
      a: "PokeWarRoom is an advanced, offline-first tactical assistant and AI coaching tool designed for competitive Pokémon VGC (specifically targeting the Regulation M-B / 2026 format). It is not a battle simulator or a matchmaking client. Instead, it is a \"second screen\" tool you use during team building and tournament matches to eliminate mental math, analyze matchups, and refine your strategies."
    },
    {
      q: "2. How do I import a team?",
      a: "The app features a universal importer built to handle standard Showdown formats.",
      bullets: [
        "Navigate to the Team Forge or the Roster Study Dossier.",
        "You can directly copy team text from Limitless VGC or Pokepast.es and paste the raw text block into the importer.",
        "The parser will automatically read the Species, Items, Abilities, Natures, and Moves.",
        "Note: If EVs are missing from your paste (common in Closed Team Sheets), the app will default the stats to 0."
      ]
    },
    {
      q: "3. What is the SP (Skill Points) Math Engine?",
      a: "PokeWarRoom uses a custom, streamlined Stat Point (SP) / Skill Points system instead of the traditional 510 EV system to make quick mental calculations easier mid-match.",
      bullets: [
        "The Conversion: 252 traditional EVs equal 32 SP. 4 traditional EVs equal 2 SP.",
        "The Cap: A single stat can have a maximum of 32 SP.",
        "The Total: Your combined stats across all categories cannot exceed 66 SP total. The UI will physically block you from building an illegal spread."
      ]
    },
    {
      q: "4. How does the \"Auto-Optimize SP\" feature work?",
      a: "If you import a team without EV spreads, click the \"Auto-Optimize SP\" button in the Team Forge. The AI will evaluate the Pokémon's role and automatically snap the sliders to a mathematically perfect SP distribution. It also generates a brief explanation (visible by hovering over the ? icon next to the stat) detailing why it chose that spread. If you manually adjust a slider afterward, the AI's tooltip for that stat will disappear."
    },
    {
      q: "5. What is the \"Beginner Coach\" vs. \"Pro War Room\" toggle?",
      a: "The AI adapts its coaching style based on your experience level:",
      bullets: [
        "Beginner Coach: The AI acts as a patient teacher. It provides detailed, step-by-step guidance and will always explain competitive jargon (like \"STAB,\" \"Pivoting,\" or \"Speed Control\") in plain English before using it.",
        "Pro War Room: The AI acts as a ruthless, elite strategist. It provides concise, aggressive tactical flowcharts focusing on speed-tier math and damage thresholds, assuming you already know advanced terminology."
      ]
    },
    {
      q: "6. What is the \"AI Team Builder\"?",
      a: "The AI Team Builder lets you chat with an advanced VGC Coach to brainstorm team strategies. You can ask the AI to build complete custom teams (e.g. \"Build a Rain core around Mega Swampert\"), and it will recommend a fully formatted 6-Pokemon roster with optimized items, moves, abilities, and SP spreads, which you can directly import into the Team Forge or save to your library.",
      bullets: [
        "VGC Champion Prompting: The AI is engineered with VGC Champion design logic (Intimidate cycling, benchmark speed creeping, tempo/board pressure, and hazard control).",
        "Strict Legality Check: Every team generated is automatically audited and filtered to ensure 100% legal species, forms, moves, and held items."
      ]
    },
    {
      q: "7. How are Regulation M-B Whitelists enforced?",
      a: "The app enforces absolute compliance with official Regulation M-B whitelists (scraped from rotompicks.com):",
      bullets: [
        "Legal Pokemon: Supports exactly the 231 legal base species, regional variants, and 75 Mega Evolutions (including new additions like floette-eternal).",
        "Legal Items: Strictly whitelists the 148 battle-legal items, Mega Stones, and Berries.",
        "Legal Moves: Restricts moveset autocompletes to the 486 legal moves.",
        "Double-Pass Critic: If the primary coach draft recommends an illegal move or item, the VGC Critic AI automatically intercepts, flags, and rewrites the payload before it reaches your screen."
      ]
    },
    {
      q: "8. How do Operator Accounts, Profiles, and Passkey Resets work?",
      a: "PokeWarRoom supports full operational credentials and access controls:",
      bullets: [
        "Login / Sign Up: Register a secure operator account using your email link and password.",
        "Forgot Passkey: In the login screen, click 'Forgot Passkey?' to send password recovery instructions to your email.",
        "Operator Profile Modal: When logged in, click the Profile button in the status bar to view your operator details (email, security ID) and change your password securely.",
        "Delete Account: You can wipe your account and all associated cloud strategies/teams permanently via the 'Delete Account' button."
      ]
    },
    {
      q: "9. How does the \"Live Logger\" work?",
      a: "The Live Logger is your mid-match tactical dashboard, designed to be used during the intense 90-second Team Preview phase.",
      bullets: [
        "Scouting: As you see your opponent's team, quickly input their 6 Pokémon.",
        "The Draft Phase: Select the 4 Pokémon you intend to bring, and predict the 4 Pokémon your opponent will bring.",
        "Generate Playbook: Hit \"Assess Matchup\" to generate an immediate, AI-driven tactical flowchart for Turn 1 and Turn 2 contingencies."
      ]
    },
    {
      q: "10. How does the AI \"Learn\"? (The Memory Engine)",
      a: "PokeWarRoom features a Long-Term Memory Engine. After a match, open the Match Debrief modal to log a Win or Loss and add a brief note about what happened. The backend extracts a concrete VGC rule from that debrief and saves it to your database. The AI cross-references this memory bank in future sessions, actively avoiding strategies that have burned you in the past."
    }
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center pb-20 px-4 relative overflow-hidden selection:bg-red-500/30">
      {/* Premium ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-4xl h-[400px] bg-red-700/5 rounded-full blur-3xl pointer-events-none z-0" />
      
      {/* Decorative technical lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Top Header */}
      <div className="w-full max-w-4xl flex justify-between items-center py-6 mb-12 border-b border-zinc-900 z-10 relative">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-widest bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              PokeWarRoom User Manual
            </h1>
          </div>
          <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">VGC Academy Reference Guide</span>
        </div>
        
        <Link 
          href="/" 
          className="text-xs font-black uppercase tracking-widest bg-zinc-900 border border-zinc-800 text-zinc-350 hover:text-white hover:border-zinc-500 px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2"
        >
          ← Return to Terminal
        </Link>
      </div>

      {/* FAQ Grid */}
      <div className="w-full max-w-4xl z-10 relative space-y-6">
        {faqs.map((faq, index) => (
          <div 
            key={index}
            className="bg-zinc-900/40 border border-zinc-850 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group hover:border-red-950/40 transition-colors duration-300"
          >
            {/* Ambient hover line */}
            <div className="absolute top-0 left-0 w-1 h-full bg-transparent group-hover:bg-red-500 transition-colors duration-300" />
            
            <h3 className="text-lg font-black text-red-500 tracking-wide uppercase mb-3 border-b border-zinc-850 pb-2">
              {faq.q}
            </h3>
            
            <p className="text-sm text-zinc-300 leading-relaxed font-medium mb-4">
              {faq.a}
            </p>

            {faq.bullets && (
              <ul className="space-y-2.5 font-medium text-xs text-zinc-400 pl-4 border-l border-zinc-800">
                {faq.bullets.map((bullet, bIndex) => (
                  <li key={bIndex} className="flex items-start gap-2.5 leading-relaxed">
                    <span className="text-red-500 font-black font-mono">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

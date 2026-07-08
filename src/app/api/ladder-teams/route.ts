import { NextResponse } from 'next/server';
import { load } from 'cheerio';
import staticMetaTeams from '../../../data/meta_teams.json';

const BASE = 'https://play.limitlesstcg.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PokeWarRoom/1.0)',
  'Accept': 'text/html,application/xhtml+xml',
};

// Max teams to return — keeps serverless response time well under 10 s
const MAX_TEAMS = 8;

interface LimitlessTeam {
  name: string;
  paste: string;
}

/**
 * Fetch a URL with a browser-like UA and return the HTML text.
 * Throws on non-2xx status so callers can catch and fall back.
 */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Scrape the completed VGC tournament list and return the first
 * Reg M-B tournament ID found (data-format="1" = Pokémon Champions / Reg M-B).
 * Guardrail 2: Defensive — returns null on any failure without crashing.
 */
async function findLatestTournamentId(): Promise<string | null> {
  try {
    const html = await fetchHtml(
      `${BASE}/tournaments/completed?game=VGC&format=VGC&show=25`
    );
    const $ = load(html);

    let found: string | null = null;
    $('table.completed-tournaments tr').each((_i, row) => {
      if (found) return;
      const href = $(row).find('td a[href*="/tournament/"]').first().attr('href') ?? '';
      // href shape: /tournament/{id}/standings
      const match = href.match(/\/tournament\/([^/]+)\//);
      if (match) found = match[1];
    });

    return found;
  } catch {
    return null;
  }
}

/**
 * Given a tournament ID, scrape the standings page and collect the top
 * player slugs (up to MAX_TEAMS). Returns empty array on failure.
 */
async function getTopPlayerSlugs(tournamentId: string): Promise<string[]> {
  try {
    const html = await fetchHtml(`${BASE}/tournament/${tournamentId}/standings`);
    const $ = load(html);
    const slugs: string[] = [];

    // Standings table rows link to /tournament/{id}/player/{slug}
    $('table tr td a[href*="/player/"]').each((_i, el) => {
      if (slugs.length >= MAX_TEAMS) return;
      const href = $(el).attr('href') ?? '';
      const match = href.match(/\/player\/([^/]+)$/);
      // Only plain player links, not /teamlist sub-links
      if (match && !href.includes('/teamlist')) {
        const slug = match[1];
        if (!slugs.includes(slug)) slugs.push(slug);
      }
    });

    return slugs;
  } catch {
    return [];
  }
}

/**
 * Fetch one player's teamlist page and extract the raw PokePaste text that
 * Limitless embeds as:  const teamlist = `...`
 *
 * Guardrail 2: defensive — accounts for \r\n, returns null on parse failure.
 */
async function fetchPlayerPaste(tournamentId: string, playerSlug: string): Promise<string | null> {
  try {
    const html = await fetchHtml(
      `${BASE}/tournament/${tournamentId}/player/${playerSlug}/teamlist`
    );

    // Limitless always embeds: const teamlist = `<paste text>`
    // [\s\S] matches across newlines (dotAll workaround for older Node targets)
    const match = html.match(/const teamlist\s*=\s*`([\s\S]*?)`/);
    if (!match || !match[1]) return null;

    const paste = match[1].trim();
    // Sanity check: must contain at least one Ability line (valid PokePaste)
    if (!paste.toLowerCase().includes('ability:')) return null;

    return paste;
  } catch {
    return null;
  }
}

/**
 * Derive a readable team name from the player slug + their lead Pokémon species.
 * Always returns a string, never throws.
 */
function teamLabel(playerSlug: string, paste: string): string {
  try {
    const firstLine = paste.split('\n').find(l => l.trim().length > 0) ?? '';
    const speciesRaw = firstLine.includes('@')
      ? firstLine.split('@')[0].trim()
      : firstLine.trim();
    // Strip gender tags (M) / (F) defensively
    const species = speciesRaw.replace(/\s*\([MF]\)\s*/g, '').trim() || 'Unknown';
    return `${playerSlug} — ${species} Lead`;
  } catch {
    return playerSlug;
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    // ── Step 1: find the most recent completed Reg M-B tournament ──────────
    const tournamentId = await findLatestTournamentId();
    if (!tournamentId) {
      console.warn('[limitless] No tournament ID found — falling back to static data');
      return NextResponse.json({ teams: staticMetaTeams, source: 'fallback' });
    }

    // ── Step 2: collect top player slugs ────────────────────────────────────
    const playerSlugs = await getTopPlayerSlugs(tournamentId);
    if (playerSlugs.length === 0) {
      console.warn('[limitless] No player slugs scraped — falling back to static data');
      return NextResponse.json({ teams: staticMetaTeams, source: 'fallback' });
    }

    // ── Step 3: fetch each player's paste concurrently ──────────────────────
    const results = await Promise.allSettled(
      playerSlugs.map(slug => fetchPlayerPaste(tournamentId, slug))
    );

    const teams: LimitlessTeam[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const slug = playerSlugs[idx];
        teams.push({
          name: teamLabel(slug, result.value),
          paste: result.value,
        });
      }
    });

    // ── Step 4: fallback if scraping yielded nothing ─────────────────────────
    if (teams.length === 0) {
      console.warn('[limitless] Scraper returned 0 valid teams — falling back to static data');
      return NextResponse.json({ teams: staticMetaTeams, source: 'fallback' });
    }

    return NextResponse.json({
      teams,
      source: 'limitless',
      tournament: tournamentId,
      scraped: teams.length,
    });

  } catch (error) {
    console.error('[limitless] Scraper crashed — serving static fallback:', error);
    return NextResponse.json({ teams: staticMetaTeams, source: 'fallback' });
  }
}

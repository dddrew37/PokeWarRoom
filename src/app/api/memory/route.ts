import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for the memory API.
 * Uses the anon key (matching the existing project pattern).
 * Requires the ai_learned_tactics table to exist in Supabase.
 */
function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const TABLE = 'ai_learned_tactics';

// ─── GET /api/memory ──────────────────────────────────────────────────────────
// Returns all rows ordered by created_at descending.
export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, rule_text, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Memory API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactics: data ?? [] });
}

// ─── PATCH /api/memory ────────────────────────────────────────────────────────
// Toggles a rule's is_active state. Body: { id: string, is_active: boolean }
export async function PATCH(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured.' },
      { status: 503 }
    );
  }

  let body: { id?: string; is_active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { id, is_active } = body;

  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'Body must include id (string) and is_active (boolean).' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ is_active })
    .eq('id', id)
    .select('id, rule_text, is_active, created_at')
    .single();

  if (error) {
    console.error('[Memory API] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactic: data });
}

// ─── DELETE /api/memory ───────────────────────────────────────────────────────
// Permanently deletes a rule. Body: { id: string }
export async function DELETE(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured.' },
      { status: 503 }
    );
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'Body must include id (string).' }, { status: 400 });
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Memory API] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ─── POST /api/memory ─────────────────────────────────────────────────────────
// Inserts a new rule into ai_learned_tactics. Body: { rule_text: string }
export async function POST(request: Request) {
  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured.' },
      { status: 503 }
    );
  }

  let body: { rule_text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { rule_text } = body;

  if (!rule_text || typeof rule_text !== 'string' || !rule_text.trim()) {
    return NextResponse.json(
      { error: 'Body must include a non-empty rule_text (string).' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ rule_text: rule_text.trim(), is_active: true })
    .select('id, rule_text, is_active, created_at')
    .single();

  if (error) {
    console.error('[Memory API] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactic: data }, { status: 201 });
}

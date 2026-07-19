import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TABLE = 'ai_learned_tactics';

/**
 * Creates a server-side Supabase client authenticated with the user's JWT session token.
 * Extracts the token from either the Authorization Bearer header or the sb-access-token cookie.
 */
async function getAuthenticatedSupabase(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false
    }
  });

  // Extract session access token
  let token = "";
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/sb-access-token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (token) {
    const { error } = await client.auth.setSession({
      access_token: token,
      refresh_token: ''
    });
    if (error) {
      console.warn("[Memory API] Failed to set session from token:", error.message);
    }
  }

  return client;
}

// ─── GET /api/memory ──────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const supabase = await getAuthenticatedSupabase(request);
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.' },
      { status: 503 }
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // If not authenticated, return an empty array gracefully (Guest Mode)
    return NextResponse.json({ tactics: [] });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, rule_text, is_active, created_at, user_id')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Memory API] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactics: data ?? [] });
}

// ─── PATCH /api/memory ────────────────────────────────────────────────────────
export async function PATCH(request: Request) {
  const supabase = await getAuthenticatedSupabase(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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
    .eq('user_id', user.id)
    .select('id, rule_text, is_active, created_at')
    .single();

  if (error) {
    console.error('[Memory API] PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactic: data });
}

// ─── DELETE /api/memory ───────────────────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = await getAuthenticatedSupabase(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[Memory API] DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ─── POST /api/memory ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await getAuthenticatedSupabase(request);
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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
    .insert({ rule_text: rule_text.trim(), is_active: true, user_id: user.id })
    .select('id, rule_text, is_active, created_at')
    .single();

  if (error) {
    console.error('[Memory API] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tactic: data }, { status: 201 });
}

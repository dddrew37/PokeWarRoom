import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing session token" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Database configuration error. Please check environment variables." },
      { status: 500 }
    );
  }

  try {
    // 1. Initialize verification client to authenticate the bearer token
    const verificationClient = createClient(url, anonKey, {
      auth: {
        persistSession: false
      }
    });

    const { data: { user }, error: authError } = await verificationClient.auth.getUser(token);
    if (authError || !user) {
      console.error("[Delete Account API] JWT verification failed:", authError);
      return NextResponse.json(
        { error: "Authentication failed: " + (authError?.message || "Invalid token") },
        { status: 401 }
      );
    }

    // 2. Initialize admin client to perform user deletion
    const adminClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("[Delete Account API] deleteUser admin error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`[Delete Account API] Successfully wiped user ${user.id} (${user.email})`);
    return NextResponse.json({ success: true, message: "Account deleted successfully." });
  } catch (err: any) {
    console.error("[Delete Account API] Exception encountered:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during account deletion." },
      { status: 500 }
    );
  }
}

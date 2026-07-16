"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface AuthOverlayProps {
  onSuccess?: (session: any) => void;
}

export default function AuthOverlay({ onSuccess }: AuthOverlayProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!supabase) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-md">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none z-0" />
        <div className="relative z-10 max-w-md w-full bg-zinc-900 border border-red-900/40 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="h-12 w-12 rounded-full bg-red-950/30 border border-red-800 text-red-500 flex items-center justify-center mx-auto text-xl animate-pulse font-mono">
            ⚠️
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-widest text-red-500">Configuration Error</h2>
            <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase">
              Supabase environment variables are missing. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (!supabase) {
      setErrorMsg("Authentication service is unavailable (Supabase is not initialized).");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        if (data.session && onSuccess) {
          onSuccess(data.session);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccessMsg("Registration successful! Check your Comms Link (Email) for verification.");
      }
    } catch (err: any) {
      console.error("[Auth] Error during submission:", err);
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setErrorMsg("Authentication service is unavailable (Supabase is not initialized).");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("[Auth] Google OAuth error:", err);
      setErrorMsg(err.message || "Failed to initialize Google login.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm overflow-y-auto">
      {/* Premium ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-lg h-[400px] bg-red-700/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      <div className="relative z-10 max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
        
        {/* Terminal Header */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-widest bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              PokeWarRoom
            </h1>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
            V2.0 Access Authorization
          </span>
        </div>

        {/* Form Selection Tabs */}
        <div className="flex bg-black/45 border border-zinc-850 p-1 rounded-xl">
          <button
            onClick={() => {
              setMode("login");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
              mode === "login"
                ? "bg-red-950/20 text-red-500 border border-red-900/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Access
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
              mode === "signup"
                ? "bg-red-950/20 text-red-500 border border-red-900/40"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Register
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="bg-red-950/20 border border-red-900/45 text-red-400 p-4 rounded-xl text-xs font-mono font-bold leading-relaxed uppercase">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-green-950/20 border border-green-900/45 text-green-400 p-4 rounded-xl text-xs font-mono font-bold leading-relaxed uppercase">
            ✓ {successMsg}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
              Comms Link (Email)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@pokewarroom.com"
              disabled={loading}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-750 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
              Passkey (Password)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              disabled={loading}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-750 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Authorizing...</span>
              </>
            ) : mode === "login" ? (
              "Initialize Comms Link"
            ) : (
              "Create Operational Account"
            )}
          </button>
        </form>

        {/* Third-Party Authentication */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-zinc-850"></div>
          <span className="flex-shrink mx-4 text-[9px] text-zinc-650 font-mono font-bold uppercase tracking-widest">
            Identity Grid
          </span>
          <div className="flex-grow border-t border-zinc-850"></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          type="button"
          className="w-full py-3 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"
        >
          {/* Custom Google Logo Icon */}
          <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          Google Identity Grid
        </button>
      </div>
    </div>
  );
}

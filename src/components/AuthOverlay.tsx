"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface AuthOverlayProps {
  onSuccess?: (session: any) => void;
  onGuestLogin?: () => void;
}

export default function AuthOverlay({ onSuccess, onGuestLogin }: AuthOverlayProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
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
    if (mode !== "forgot" && (!email.trim() || !password.trim())) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    if (mode === "forgot" && !email.trim()) {
      setErrorMsg("Please enter your email address.");
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
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccessMsg("Registration successful! Check your Comms Link (Email) for verification.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setSuccessMsg("Dispatched password reset instructions to your email.");
      }
    } catch (err: any) {
      console.error("[Auth] Error during submission:", err);
      setErrorMsg(err.message || "An authentication error occurred.");
    } finally {
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
        {mode !== "forgot" ? (
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
        ) : (
          <div className="text-center py-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-red-500">Recover Access</h2>
          </div>
        )}

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

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                  Passkey (Password)
                </label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                    className="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider font-mono cursor-pointer"
                  >
                    Forgot Passkey?
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-750 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] uppercase tracking-widest flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Processing...</span>
              </>
            ) : mode === "login" ? (
              "Initialize Comms Link"
            ) : mode === "signup" ? (
              "Create Operational Account"
            ) : (
              "Send Recovery Email"
            )}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg("");
                setSuccessMsg("");
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-zinc-850 hover:bg-zinc-800 text-zinc-300 uppercase tracking-widest transition-all text-center block cursor-pointer"
            >
              Back to Login
            </button>
          )}
        </form>

        {/* Offline Simulation / Continue as Guest */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-zinc-850"></div>
          <span className="flex-shrink mx-4 text-[9px] text-zinc-650 font-mono font-bold uppercase tracking-widest">
            Offline Simulation
          </span>
          <div className="flex-grow border-t border-zinc-850"></div>
        </div>

        <button
          onClick={onGuestLogin}
          type="button"
          className="w-full py-3.5 rounded-xl font-black text-xs transition-all duration-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/50 text-red-400 hover:text-red-300 uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.05)] cursor-pointer"
        >
          ⚡ Continue as Guest (Offline Mode)
        </button>
      </div>
    </div>
  );
}

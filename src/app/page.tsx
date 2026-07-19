"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TeamForge from "@/components/TeamForge";
import TeamPreviewLogger from "@/components/TeamPreviewLogger";
import SavedStrategies from "@/components/SavedStrategies";
import RosterDossier from "@/components/RosterDossier";
import MemoryDashboard from "@/components/MemoryDashboard";
import AIBuilder from "@/components/AIBuilder";
import { ParsedPokemon } from "@/lib/parser";
import { supabase } from "@/lib/supabase";
import AuthOverlay from "@/components/AuthOverlay";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"forge" | "logger" | "saved" | "dossier" | "memory" | "builder">("forge");
  const [teamState, setTeamState] = useState<ParsedPokemon[]>([]);
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setResetError("Please fill in all fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    if (!supabase) {
      setResetError("Supabase client is not initialized.");
      return;
    }

    setResetLoading(true);
    setResetError("");
    setResetSuccess("");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetSuccess("Passkey updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("[Profile] Error resetting password:", err);
      setResetError(err.message || "Failed to update passkey.");
    } finally {
      setResetLoading(false);
    }
  };

  const syncSessionCookie = (session: any) => {
    if (session) {
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax; Secure`;
    } else {
      document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
    }
  };

  const handleDeleteAccount = async () => {
    if (!supabase) return;
    setIsDeleting(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        alert("No active session found.");
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }

      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentSession.access_token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const resData = await response.json();
        throw new Error(resData.error || "Failed to delete account");
      }

      await supabase.auth.signOut();
      setSession(null);
      syncSessionCookie(null);
      setIsGuest(false);
      alert("Your operator account and all associated data have been permanently wiped.");
    } catch (err: any) {
      console.error("[Delete Account] Error:", err);
      alert("Failed to delete account: " + (err.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    // 1. Initial Check: Try to get existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      syncSessionCookie(session);
      setAuthLoading(false);
      // If session exists, we are done
      if (session) return;

      // 2. PKCE/Hash Handler: Check the URL for the #access_token hash
      if (typeof window !== 'undefined' && window.location.hash) {
        const client = supabase;
        if (client) {
          client.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              // Successfully exchanged token. Clean the URL bar.
              window.history.replaceState(null, '', window.location.pathname);
            }
          });
        }
      }
    });

    // 3. Set up Persistent Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Supabase Auth Event:', event);
      setSession(session);
      syncSessionCookie(session);
      setAuthLoading(false);
    });

    // 4. Cleanup
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-center">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-red-500 border-t-transparent"></div>
        <p className="text-xs font-black uppercase tracking-widest text-red-500 animate-pulse font-mono">Loading Session...</p>
      </div>
    );
  }

  if (supabase && !session && !isGuest) {
    return <AuthOverlay onSuccess={(sess) => setSession(sess)} onGuestLogin={() => setIsGuest(true)} />;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center pb-20 px-4 relative overflow-hidden selection:bg-red-500/30">
      {/* Premium ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-4xl h-[400px] bg-red-700/5 rounded-full blur-3xl pointer-events-none z-0" />
      
      {/* Decorative technical lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />
      
      {/* Top Status Bar */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-center py-6 mb-12 border-b border-zinc-900 z-10 relative">
        <div className="flex flex-col items-center md:items-start gap-1">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-xl font-black uppercase tracking-widest bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              PokeWarRoom
            </h1>
          </div>
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Tactical Coaching Terminal</span>
        </div>
        
        <div className="flex items-center gap-6 mt-4 md:mt-0 font-mono text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
          <Link href="/manual" className="text-zinc-400 hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/10 transition-all mr-2 flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 rounded-lg">
            📖 User Manual
          </Link>
          {isGuest && (
            <button
              onClick={() => {
                setIsGuest(false);
              }}
              className="text-zinc-400 hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/10 transition-all flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              🔑 Create Account / Login
            </button>
          )}
          {session && (
            <>
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-zinc-400 hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/10 transition-all flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                👤 Operator Profile
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-500 hover:text-white hover:border-red-900 hover:bg-red-950/50 transition-all flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] border border-red-950/45 bg-red-950/10 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                ⚠️ Delete Account
              </button>
              <button
                onClick={async () => {
                  if (supabase) {
                    await supabase.auth.signOut();
                    syncSessionCookie(null);
                  }
                }}
                className="text-zinc-400 hover:text-red-500 hover:border-red-900/40 hover:bg-red-950/10 transition-all flex items-center gap-1.5 font-black uppercase tracking-widest text-[8px] border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                🚪 Sign Out
              </button>
            </>
          )}
          <div>
            <span className="text-zinc-600 mr-1.5 font-semibold">SYS STATUS:</span>
            <span className="text-red-500 font-black">OPERATIONAL</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-zinc-600 mr-1.5 font-semibold">REGULATION:</span>
            <span className="text-zinc-300 font-black">M-B</span>
          </div>
          <div>
            <span className="text-zinc-600 mr-1.5 font-semibold">ENGINE:</span>
            <span className="text-zinc-300 font-black">SP V2</span>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="w-full max-w-3xl flex bg-black/40 backdrop-blur-md rounded-2xl p-1.5 mb-10 border border-zinc-850 shadow-2xl relative z-10">
        <button
          onClick={() => setActiveTab("forge")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "forge" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Team Forge
        </button>
        <button
          onClick={() => setActiveTab("dossier")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "dossier" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Roster Dossier
        </button>
        <button
          onClick={() => setActiveTab("builder")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "builder"
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          AI Team Builder
        </button>
        <button
          onClick={() => setActiveTab("logger")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "logger" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Live Logger
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "saved" 
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40" 
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Saved Books
        </button>
        <button
          onClick={() => setActiveTab("memory")}
          className={`flex-1 py-2.5 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
            activeTab === "memory"
              ? "bg-red-950/20 text-red-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-red-900/40"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Coach Memory
        </button>
      </div>

      <div className="w-full relative z-10">
        {activeTab === "forge" && <TeamForge team={teamState} setTeam={setTeamState} session={session} />}
        {activeTab === "logger" && <TeamPreviewLogger playerTeam={teamState} onGoToForge={() => setActiveTab("forge")} session={session} />}
        {activeTab === "saved" && <SavedStrategies session={session} />}
        {activeTab === "dossier" && <RosterDossier session={session} />}
        {activeTab === "memory" && <MemoryDashboard session={session} />}
        {activeTab === "builder" && <AIBuilder setTeam={setTeamState} setActiveTab={setActiveTab} session={session} />}
      </div>

      {/* Account Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-zinc-900 border-2 border-red-900/40 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 text-center">
            <div className="h-14 w-14 rounded-full bg-red-950/30 border border-red-800 text-red-500 flex items-center justify-center mx-auto text-2xl font-mono animate-pulse">
              ⚠️
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black uppercase tracking-wider text-red-500">Deauthorize Operator Profile?</h3>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed uppercase">
                Warning: This action is permanent and irreversible. Your account credentials, profile metadata, and all cloud strategies/teams will be deleted from the database.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl font-bold text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 py-3 rounded-xl font-black text-xs bg-red-750 hover:bg-red-650 border border-red-650 text-white hover:text-red-100 uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Wiping...</span>
                  </>
                ) : (
                  "Wipe Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operator Profile Modal */}
      {showProfileModal && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-sm">
          <div className="relative max-w-md w-full bg-zinc-900 border-2 border-zinc-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider text-white">Operator Profile</h3>
                <p className="text-[9px] text-zinc-500 font-mono font-bold uppercase tracking-widest mt-1">Credentials & Passkey Management</p>
              </div>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setResetError("");
                  setResetSuccess("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                className="text-zinc-500 hover:text-zinc-300 text-xs font-mono font-black border border-zinc-800 bg-zinc-950/40 px-2.5 py-1 rounded-md"
              >
                ESC
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono uppercase">
              <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-xl space-y-2">
                <p className="text-[9px] font-bold text-zinc-500 tracking-wider">Operational Email:</p>
                <p className="text-zinc-200 font-extrabold break-all font-sans lowercase">{session.user?.email}</p>
                
                <p className="text-[9px] font-bold text-zinc-500 tracking-wider mt-4">Security Passkey ID:</p>
                <p className="text-zinc-400 break-all text-[10px] font-mono">{session.user?.id}</p>
              </div>

              {/* Feedback messages */}
              {resetError && (
                <div className="bg-red-950/20 border border-red-900/45 text-red-400 p-4 rounded-xl font-bold leading-relaxed">
                  ⚠️ {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="bg-green-950/20 border border-green-900/45 text-green-400 p-4 rounded-xl font-bold leading-relaxed">
                  ✓ {resetSuccess}
                </div>
              )}

              {/* Change Password Form */}
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 tracking-widest block">New Passkey (Password)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={resetLoading}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-750 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-zinc-500 tracking-widest block">Confirm Passkey</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    disabled={resetLoading}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder:text-zinc-750 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500/20 outline-none w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 rounded-xl font-black text-xs transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-red-700 hover:bg-red-600 border border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.2)] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {resetLoading ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                      <span>Saving Passkey...</span>
                    </>
                  ) : (
                    "Update Passkey"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

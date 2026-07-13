"use client";

import { useState, useEffect, useCallback } from "react";

interface Tactic {
  id: string;
  rule_text: string;
  is_active: boolean;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-all duration-300 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked
          ? "bg-red-600 border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.4)]"
          : "bg-zinc-800 border-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ── Trash Icon ────────────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ── Brain Icon ────────────────────────────────────────────────────────────────
function BrainIcon() {
  return (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest font-mono">
          No Directives Recorded
        </p>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider font-mono mt-1">
          Spar with the coach to extract lessons.
        </p>
      </div>
    </div>
  );
}

// ── Unavailable State ─────────────────────────────────────────────────────────
function UnavailableState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-950/20 border border-red-900/30 flex items-center justify-center">
        <svg className="w-7 h-7 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-black text-red-500 uppercase tracking-widest font-mono">
          Memory Unavailable
        </p>
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider font-mono mt-1 max-w-xs">
          {message}
        </p>
      </div>
    </div>
  );
}

// ── Tactic Card ───────────────────────────────────────────────────────────────
function TacticCard({
  tactic,
  onToggle,
  onDelete,
}: {
  tactic: Tactic;
  onToggle: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(tactic.id, tactic.is_active);
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-cancel confirm after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    await onDelete(tactic.id);
    // No need to reset — card will be removed from list
  };

  return (
    <div
      className={`group relative w-full bg-zinc-950 border rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300 ${
        tactic.is_active
          ? "border-zinc-800 hover:border-zinc-700"
          : "border-zinc-900 opacity-50 hover:opacity-70"
      } ${deleting ? "opacity-30 pointer-events-none scale-95" : ""}`}
    >
      {/* Active indicator stripe */}
      {tactic.is_active && (
        <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-red-600 rounded-full" />
      )}

      {/* Rule text */}
      <p className="text-[11px] font-semibold text-zinc-300 leading-relaxed font-mono pl-3 pr-2 whitespace-pre-wrap break-words">
        {tactic.rule_text}
      </p>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-3 pl-3">
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
          {formatDate(tactic.created_at)}
        </span>

        <div className="flex items-center gap-3">
          {/* Active label + toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-widest font-mono transition-colors ${
              tactic.is_active ? "text-red-500" : "text-zinc-600"
            }`}>
              {tactic.is_active ? "Active" : "Off"}
            </span>
            <ToggleSwitch
              checked={tactic.is_active}
              onChange={handleToggle}
              disabled={toggling}
            />
          </div>

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest font-mono border transition-all duration-200 disabled:opacity-40 ${
              confirmDelete
                ? "bg-red-950/40 border-red-600 text-red-400 shadow-[0_0_8px_rgba(220,38,38,0.3)]"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-red-900 hover:text-red-500"
            }`}
            title={confirmDelete ? "Click again to confirm deletion" : "Delete directive"}
          >
            <TrashIcon />
            <span>{confirmDelete ? "Confirm?" : "Delete"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function MemoryDashboard() {
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchTactics = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await fetch("/api/memory");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to load memory directives.");
        return;
      }

      setTactics(data.tactics ?? []);
    } catch (e) {
      setError("Network error — could not reach the memory API.");
      console.error("[MemoryDashboard] fetch error:", e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTactics();
  }, [fetchTactics]);

  // Optimistic toggle
  const handleToggle = useCallback(async (id: string, currentValue: boolean) => {
    const newValue = !currentValue;

    // Optimistic update
    setTactics(prev =>
      prev.map(t => t.id === id ? { ...t, is_active: newValue } : t)
    );

    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: newValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Revert on failure
        setTactics(prev =>
          prev.map(t => t.id === id ? { ...t, is_active: currentValue } : t)
        );
        console.error("[MemoryDashboard] PATCH error:", data.error);
      }
    } catch (e) {
      // Revert on network error
      setTactics(prev =>
        prev.map(t => t.id === id ? { ...t, is_active: currentValue } : t)
      );
      console.error("[MemoryDashboard] PATCH network error:", e);
    }
  }, []);

  // Optimistic delete
  const handleDelete = useCallback(async (id: string) => {
    const snapshot = tactics.find(t => t.id === id);

    // Optimistic remove
    setTactics(prev => prev.filter(t => t.id !== id));

    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Restore on failure
        if (snapshot) {
          setTactics(prev => [snapshot, ...prev]);
        }
        console.error("[MemoryDashboard] DELETE error:", data.error);
      }
    } catch (e) {
      // Restore on network error
      if (snapshot) {
        setTactics(prev => [snapshot, ...prev]);
      }
      console.error("[MemoryDashboard] DELETE network error:", e);
    }
  }, [tactics]);

  const activeTactics = tactics.filter(t => t.is_active).length;
  const totalTactics = tactics.length;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <BrainIcon />
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono">
              Coach Memory
            </h2>
          </div>
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
            Long-Term Tactical Directive Engine — Phase 1
          </p>
        </div>

        {/* Stats + Refresh */}
        <div className="flex items-center gap-3">
          {totalTactics > 0 && (
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 font-mono">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Active</span>
              <span className="text-xs font-black text-red-500">{activeTactics}</span>
              <span className="text-zinc-700">/</span>
              <span className="text-xs font-black text-zinc-300">{totalTactics}</span>
            </div>
          )}
          <button
            onClick={() => fetchTactics(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-400 uppercase tracking-widest font-mono transition-all disabled:opacity-40"
          >
            <svg
              className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isRefreshing ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-900" />

      {/* Content area */}
      {loading ? (
        // Skeleton loader
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-4 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="h-3 bg-zinc-800 rounded w-3/4 mb-3" />
              <div className="h-3 bg-zinc-800 rounded w-1/2 mb-4" />
              <div className="flex justify-between items-center">
                <div className="h-2 bg-zinc-900 rounded w-24" />
                <div className="h-5 bg-zinc-800 rounded-full w-9" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <UnavailableState message={error} />
      ) : tactics.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {tactics.map(tactic => (
            <TacticCard
              key={tactic.id}
              tactic={tactic}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

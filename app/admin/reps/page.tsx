"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";

type TeamRep = { email: string; team_slug: string; created_at: string };

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

export default function AdminRepsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [reps, setReps] = useState<TeamRep[]>([]);
  const [isLoadingReps, setIsLoadingReps] = useState(true);
  const [email, setEmail] = useState("");
  const [teamSlug, setTeamSlug] = useState(TEAMS[0]?.slug ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Which teams already have a rep, so the assign form can flag a reassignment
  // rather than silently stacking a second rep onto one team.
  const takenBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const rep of reps) map.set(rep.team_slug, rep.email);
    return map;
  }, [reps]);

  // State is only ever set inside the async .then, never synchronously in the
  // effect body (isLoadingReps starts true and flips false once loaded), which
  // keeps this off the cascading-render path.
  const loadReps = useCallback(() => {
    supabase.rpc("admin_list_team_reps").then(({ data, error: rpcError }) => {
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setReps((data ?? []) as TeamRep[]);
      }
      setIsLoadingReps(false);
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadReps();
  }, [isAdmin, loadReps]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !teamSlug) {
      setError("Enter an email and pick a team.");
      return;
    }

    setBusy(true);
    const { error: rpcError } = await supabase.rpc("admin_assign_team_rep", {
      p_email: trimmedEmail,
      p_team_slug: teamSlug,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`${trimmedEmail} can now edit ${teamName(teamSlug)}.`);
    setEmail("");
    loadReps();
  };

  const handleRemove = async (rep: TeamRep) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const { error: rpcError } = await supabase.rpc("admin_remove_team_rep", {
      p_email: rep.email,
      p_team_slug: rep.team_slug,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`Removed ${rep.email} from ${teamName(rep.team_slug)}.`);
    loadReps();
  };

  if (isLoading) {
    return null;
  }

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-zinc-900 dark:text-zinc-100">
        <AdminLoginForm />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-center text-zinc-900 dark:text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Only a full admin can manage team reps.</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
        >
          Log out
        </button>
      </main>
    );
  }

  const taken = takenBySlug.get(teamSlug);
  const inputClass =
    "w-full rounded border border-black/15 dark:border-white/20 bg-white dark:bg-[#0b1a29] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-accent focus:outline-none";

  return (
    <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/admin"
          className="inline-block text-xs font-bold text-accent hover:text-accent-hover dark:hover:text-accent-hover"
        >
          ← Back to Admin mode
        </Link>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Manage reps</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A rep can edit only the team you assign them — the same edit and review powers you have,
          fenced to that one page. Enter the email of any existing Bobble Shelf account (they just
          need to have signed up on the site, by any method); their access turns on next time
          they&apos;re signed in — no separate admin login.
        </p>

        <form
          onSubmit={handleAssign}
          className="mt-6 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1a29] p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rep email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jody@example.com"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Team</span>
              <select value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} className={`mt-1 ${inputClass}`}>
                {TEAMS.map((team) => (
                  <option key={team.slug} value={team.slug}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {taken ? (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              {teamName(teamSlug)} already has a rep ({taken}). Assigning another adds a second rep for this team.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-4 rounded border border-accent/60 bg-accent/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-50"
          >
            {busy ? "Working…" : "Assign rep"}
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

        <h2 className="mt-8 text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">
          Current reps
        </h2>
        {isLoadingReps ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        ) : reps.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">No reps assigned yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1a29]">
            {reps.map((rep) => (
              <li key={`${rep.email}-${rep.team_slug}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{rep.email}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{teamName(rep.team_slug)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(rep)}
                  disabled={busy}
                  className="shrink-0 rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300 transition hover:border-red-500 hover:text-red-500 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

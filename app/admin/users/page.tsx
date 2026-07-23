"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AdminEmailComposer, type EmailTarget } from "@/components/AdminEmailComposer";
import { AdminFilterBar } from "@/components/AdminFilterBar";
import { useAdminAuth } from "@/lib/adminAuth";
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from "@/lib/auth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";
import { type AdminFilter, useAdminFilters } from "@/lib/useAdminFilters";

type TeamRep = { email: string; team_slug: string };

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  owned_count: number;
  favorite_count: number;
  wanted_count: number;
  submission_count: number;
  report_count: number;
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

function joinedWithinDays(createdAt: string, days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() >= cutoff;
}

const searchUser = (row: AdminUser) => `${row.email ?? ""} ${row.display_name ?? ""}`;

const USER_FILTERS: AdminFilter<AdminUser>[] = [
  {
    id: "signed_in",
    allLabel: "Any sign-in status",
    get: (row) => (row.last_sign_in_at ? "yes" : "no"),
    options: [
      { value: "yes", label: "Has signed in" },
      { value: "no", label: "Never signed in" },
    ],
  },
  {
    id: "activity",
    allLabel: "Any contributions",
    get: (row) => (row.submission_count > 0 || row.report_count > 0 ? "yes" : "no"),
    options: [
      { value: "yes", label: "Has submitted or reported" },
      { value: "no", label: "No submissions or reports" },
    ],
  },
];

// useSearchParams (for the ?signed_in / ?joined deep links) needs a Suspense
// boundary during prerender, same as the view-profile route.
export default function AdminUsersPage() {
  return (
    <Suspense fallback={<main className="min-h-full bg-slate-50 dark:bg-[#15110d]" />}>
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [isLoadingRows, setIsLoadingRows] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reps, setReps] = useState<TeamRep[]>([]);
  const [repEditingId, setRepEditingId] = useState<string | null>(null);
  const [repTeamDraft, setRepTeamDraft] = useState<string>(TEAMS[0]?.slug ?? "");

  // email (lowercased) -> the team slugs that account reps. Reps are keyed by
  // email, same as admins, so this joins the rep list onto the user rows.
  const repTeamsByEmail = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rep of reps) {
      const key = rep.email.toLowerCase();
      map.set(key, [...(map.get(key) ?? []), rep.team_slug]);
    }
    return map;
  }, [reps]);

  const repTeamsFor = useCallback(
    (email: string | null) => (email ? repTeamsByEmail.get(email.toLowerCase()) ?? [] : []),
    [repTeamsByEmail],
  );

  // No cancelled guard: a late set after unmount is harmless, and this doubles
  // as the refresh after an assign/remove.
  const loadReps = useCallback(() => {
    supabase.rpc("admin_list_team_reps").then(({ data, error: repError }) => {
      if (!repError) setReps((data ?? []) as TeamRep[]);
    });
  }, []);

  // The stats-page Accounts cards deep-link here with a filter pre-applied:
  // ?signed_in=yes seeds the sign-in dropdown, ?joined=7|30 narrows to accounts
  // created in the last N days.
  const searchParams = useSearchParams();
  const signedInParam = searchParams.get("signed_in");
  const joinedParam = searchParams.get("joined");
  const joinedDays = joinedParam === "30" ? 30 : joinedParam === "7" ? 7 : null;
  const initialFilters = useMemo(() => {
    const selected: Record<string, string> = {};
    if (signedInParam === "yes" || signedInParam === "no") selected.signed_in = signedInParam;
    return { selected };
  }, [signedInParam]);

  const filter = useAdminFilters(rows, searchUser, USER_FILTERS, initialFilters);
  // "Joined in the last N days" is a range, which the equality-based dropdowns
  // can't express, so it layers on top of the dropdown/search filtering.
  const filtered = useMemo(
    () =>
      joinedDays
        ? filter.filtered.filter((row) => joinedWithinDays(row.created_at, joinedDays))
        : filter.filtered,
    [filter.filtered, joinedDays],
  );

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase.rpc("admin_list_users").then(({ data, error: fetchError }) => {
      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRows((data ?? []) as AdminUser[]);
      }
      setIsLoadingRows(false);
    });

    loadReps();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, loadReps]);

  const startRepEditing = (row: AdminUser) => {
    setRepEditingId(row.id);
    // Default the picker to the first team the user is NOT already a rep for.
    const taken = new Set(repTeamsFor(row.email));
    const firstFree = TEAMS.find((t) => !taken.has(t.slug))?.slug ?? TEAMS[0]?.slug ?? "";
    setRepTeamDraft(firstFree);
    setError(null);
  };

  const assignRep = async (row: AdminUser) => {
    if (!row.email || !repTeamDraft) return;
    setBusyId(row.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("admin_assign_team_rep", {
      p_email: row.email,
      p_team_slug: repTeamDraft,
    });

    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`${row.email} can now edit ${teamName(repTeamDraft)}.`);
    setRepEditingId(null);
    loadReps();
  };

  const removeRep = async (row: AdminUser, slug: string) => {
    if (!row.email) return;
    setBusyId(row.id);
    setError(null);

    const { error: rpcError } = await supabase.rpc("admin_remove_team_rep", {
      p_email: row.email,
      p_team_slug: slug,
    });

    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`Removed ${row.email} as ${teamName(slug)} rep.`);
    loadReps();
  };

  const startEditing = (row: AdminUser) => {
    setEditingId(row.id);
    setNameDraft(row.display_name ?? "");
    setError(null);
  };

  const saveDisplayName = async (row: AdminUser) => {
    const invalid = validateDisplayName(nameDraft);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusyId(row.id);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("admin_update_display_name", {
        p_user_id: row.id,
        p_display_name: nameDraft.trim(),
      });

      if (rpcError) throw new Error(rpcError.message);

      setRows((current) =>
        current.map((r) => (r.id === row.id ? { ...r, display_name: nameDraft.trim() } : r)),
      );
      setEditingId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update display name.");
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (row: AdminUser) => {
    setBusyId(row.id);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("admin_delete_user", { p_user_id: row.id });

      if (rpcError) throw new Error(rpcError.message);

      setRows((current) => current.filter((r) => r.id !== row.id));
      setConfirmingId(null);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not remove this user.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // "Select all" acts on the rows currently visible under the search/filters,
  // so narrowing the list then selecting all doesn't quietly pull in hidden
  // users. Selections already made for now-hidden users are preserved.
  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allSelected) {
        filtered.forEach((r) => next.delete(r.id));
      } else {
        filtered.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toRecipient = (row: AdminUser) => ({
    id: row.id,
    email: row.email,
    name: row.display_name,
  });

  const emailSelected = () => {
    const recipients = rows.filter((r) => selectedIds.has(r.id)).map(toRecipient);
    if (recipients.length === 0) return;
    setNotice(null);
    setEmailTarget({ kind: "selected", recipients });
  };

  const emailAll = () => {
    if (rows.length === 0) return;
    setNotice(null);
    setEmailTarget({ kind: "all", count: rows.length });
  };

  const emailOne = (row: AdminUser) => {
    setNotice(null);
    setEmailTarget({ kind: "selected", recipients: [toRecipient(row)] });
  };

  const selectedCount = selectedIds.size;

  if (isLoading) {
    return null;
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-10 text-center text-zinc-900 dark:text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Log in with an admin-mode account to continue.</p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
        >
          Go to admin login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 dark:bg-[#15110d] px-4 py-8 text-zinc-900 dark:text-zinc-100 sm:px-8">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white hover:text-accent-hover dark:hover:text-accent-hover">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Manage users</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
          >
            Log out
          </button>
        </div>
      </div>

      {error ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p> : null}
      {notice ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-emerald-400">{notice}</p> : null}

      {rows.length > 0 ? (
        <div className="mt-6">
          <AdminFilterBar
            filters={USER_FILTERS}
            state={filter}
            placeholder="Search by name or email…"
            total={rows.length}
            noun="users"
          />
        </div>
      ) : null}

      {joinedDays ? (
        <div className="mx-auto mt-4 flex max-w-4xl items-center gap-2">
          <span className="rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-accent">
            Joined in last {joinedDays} days
          </span>
          <Link
            href="/admin/users"
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 underline transition hover:text-accent-hover dark:hover:text-accent-hover"
          >
            Clear
          </Link>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center gap-3 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1a29] px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 accent-accent"
            />
            Select all
          </label>
          <span className="text-xs text-zinc-500">
            {selectedCount} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={emailSelected}
              className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover disabled:opacity-40"
            >
              Email selected
            </button>
            <button
              type="button"
              onClick={emailAll}
              className="rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
            >
              Email all
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No users yet.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No users match your search.</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0b1a29] p-4 sm:grid-cols-[auto_1fr_auto]"
            >
              <label className="flex items-start pt-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={() => toggleSelected(row.id)}
                  aria-label={`Select ${row.display_name ?? row.email ?? "user"}`}
                  className="h-4 w-4 accent-accent"
                />
              </label>
              <div className="text-sm">
                {editingId === row.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveDisplayName(row);
                    }}
                  >
                    <input
                      autoFocus
                      required
                      type="text"
                      maxLength={MAX_DISPLAY_NAME_LENGTH}
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      className="w-48 rounded border border-black/10 dark:border-white/15 bg-white dark:bg-[#07111d] px-2 py-1 text-sm font-black text-zinc-900 outline-none dark:text-white focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={busyId === row.id}
                      className="rounded border border-accent px-2 py-1 text-xs font-black uppercase tracking-wide text-accent disabled:opacity-60"
                    >
                      {busyId === row.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border border-black/15 dark:border-white/20 px-2 py-1 text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p className="font-black uppercase tracking-wide text-accent">
                    {row.display_name ?? "(no display name)"}
                  </p>
                )}
                <p className="mt-1 text-zinc-800 dark:text-zinc-200">{row.email}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Joined {formatDate(row.created_at)} · Last sign-in {formatDate(row.last_sign_in_at)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.owned_count} owned · {row.favorite_count} favorited · {row.wanted_count} wanted ·{" "}
                  {row.submission_count} submissions · {row.report_count} reports
                </p>
                {repTeamsFor(row.email).length > 0 ? (
                  <p className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 px-2.5 py-0.5 text-xs font-black uppercase tracking-wide text-accent">
                      Team rep: {repTeamsFor(row.email).map(teamName).join(", ")}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col justify-center gap-2">
                {editingId !== row.id ? (
                  <>
                    <Link
                      href={`/admin/users/view?id=${encodeURIComponent(row.id)}`}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover"
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => startEditing(row)}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!row.email}
                      onClick={() => emailOne(row)}
                      title={row.email ? undefined : "This account has no email address"}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover disabled:opacity-40"
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      disabled={!row.email}
                      onClick={() => (repEditingId === row.id ? setRepEditingId(null) : startRepEditing(row))}
                      title={row.email ? undefined : "A rep is identified by email; this account has none"}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-accent hover:text-accent-hover dark:hover:text-accent-hover disabled:opacity-40"
                    >
                      Team rep
                    </button>
                  </>
                ) : null}
                {confirmingId === row.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => removeUser(row)}
                      className="rounded bg-red-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-400 disabled:opacity-60"
                    >
                      {busyId === row.id ? "Removing…" : "Confirm remove"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => setConfirmingId(null)}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setConfirmingId(row.id)}
                    className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>

              {repEditingId === row.id ? (
                <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 sm:col-span-3">
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                    Team rep access
                  </p>
                  {repTeamsFor(row.email).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {repTeamsFor(row.email).map((slug) => (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-white/60 px-3 py-1 text-xs font-bold text-zinc-800 dark:bg-white/5 dark:text-zinc-200"
                        >
                          {teamName(slug)}
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => removeRep(row, slug)}
                            className="text-red-500 transition hover:text-red-400 disabled:opacity-50"
                            aria-label={`Remove ${teamName(slug)} rep access`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">Not a rep for any team yet.</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={repTeamDraft}
                      onChange={(event) => setRepTeamDraft(event.target.value)}
                      className="rounded border border-black/15 dark:border-white/20 bg-white dark:bg-[#07111d] px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100 focus:border-accent focus:outline-none"
                    >
                      {TEAMS.map((team) => (
                        <option key={team.slug} value={team.slug}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => assignRep(row)}
                      className="rounded border border-accent bg-accent/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-50"
                    >
                      {busyId === row.id ? "Working…" : "Assign team"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepEditingId(null)}
                      className="rounded border border-black/15 dark:border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {emailTarget ? (
        <AdminEmailComposer
          target={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={(count) => {
            setEmailTarget(null);
            setSelectedIds(new Set());
            setNotice(`Email sent to ${count} ${count === 1 ? "recipient" : "recipients"}.`);
          }}
        />
      ) : null}
    </main>
  );
}

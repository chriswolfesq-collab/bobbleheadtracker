"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminEmailComposer, type EmailTarget } from "@/components/AdminEmailComposer";
import { useAdminAuth } from "@/lib/adminAuth";
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from "@/lib/auth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

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

export default function AdminUsersPage() {
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

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
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
      <main className="min-h-full bg-[#15110d] px-4 py-10 text-center text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-400">Log in with an admin-mode account to continue.</p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded border border-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d]"
        >
          Go to admin login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#15110d] px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-black uppercase tracking-wide text-white hover:text-amber-300">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Manage users</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-200">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Log out
          </button>
        </div>
      </div>

      {error ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-red-400">{error}</p> : null}
      {notice ? <p className="mx-auto mt-4 max-w-4xl text-sm font-semibold text-emerald-400">{notice}</p> : null}

      {rows.length > 0 ? (
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-[#0b1a29] px-4 py-3">
          <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-zinc-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 accent-amber-400"
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
              className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
            >
              Email selected
            </button>
            <button
              type="button"
              onClick={emailAll}
              className="rounded border border-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d]"
            >
              Email all
            </button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-4xl space-y-4">
        {isLoadingRows ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-400">No users yet.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:grid-cols-[auto_1fr_auto]"
            >
              <label className="flex items-start pt-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(row.id)}
                  onChange={() => toggleSelected(row.id)}
                  aria-label={`Select ${row.display_name ?? row.email ?? "user"}`}
                  className="h-4 w-4 accent-amber-400"
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
                      className="w-48 rounded border border-white/15 bg-[#07111d] px-2 py-1 text-sm font-black text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      disabled={busyId === row.id}
                      className="rounded border border-amber-400 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-300 disabled:opacity-60"
                    >
                      {busyId === row.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border border-white/20 px-2 py-1 text-xs font-black uppercase tracking-wide text-zinc-300"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <p className="font-black uppercase tracking-wide text-amber-300">
                    {row.display_name ?? "(no display name)"}
                  </p>
                )}
                <p className="mt-1 text-zinc-200">{row.email}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Joined {formatDate(row.created_at)} · Last sign-in {formatDate(row.last_sign_in_at)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {row.owned_count} owned · {row.favorite_count} favorited · {row.wanted_count} wanted ·{" "}
                  {row.submission_count} submissions · {row.report_count} reports
                </p>
              </div>

              <div className="flex flex-col justify-center gap-2">
                {editingId !== row.id ? (
                  <>
                    <Link
                      href={`/admin/users/view?id=${encodeURIComponent(row.id)}`}
                      className="rounded border border-white/20 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => startEditing(row)}
                      className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-60"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!row.email}
                      onClick={() => emailOne(row)}
                      title={row.email ? undefined : "This account has no email address"}
                      className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
                    >
                      Email
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
                      className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => setConfirmingId(row.id)}
                    className="rounded border border-white/20 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
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

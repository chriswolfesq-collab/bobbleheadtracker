"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";

// Everything the public has sent in: /contact messages and "Become a team rep"
// applications (see supabase/inbound_messages.sql). The email notification is the
// prompt; this page is the record, so a message that got lost in a spam folder is
// still here.

type InboundMessage = {
  id: string;
  kind: string;
  name: string | null;
  email: string;
  team_slug: string | null;
  message: string;
  status: string;
  created_at: string;
  handled_at: string | null;
};

type Filter = "all" | "contact" | "rep_application";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "contact", label: "Contact" },
  { value: "rep_application", label: "Rep applications" },
];

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminMessagesPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    supabase
      .rpc("admin_list_inbound_messages", { p_kind: filter === "all" ? null : filter })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setError(null);
          setMessages((data ?? []) as InboundMessage[]);
        }
        setIsLoadingMessages(false);
      });
  }, [filter]);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

  async function toggleHandled(message: InboundMessage) {
    setBusyId(message.id);
    const { error: rpcError } = await supabase.rpc("admin_mark_message_handled", {
      p_id: message.id,
      p_handled: message.status !== "handled",
    });
    setBusyId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  if (isLoading) return null;

  if (!user) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
        <AdminLoginForm />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-600">Only a full admin can read incoming messages.</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="mt-6 rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover"
        >
          Log out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin"
          className="inline-block text-xs font-bold text-accent hover:text-accent-hover"
        >
          ← Back to Admin mode
        </Link>
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Messages</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Contact-form messages and team-rep applications. Reply straight from the notification
          email — its reply-to is the sender&apos;s address. Mark one handled to move it out of the
          way.
        </p>

        <div className="mt-6 flex gap-2">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setIsLoadingMessages(true);
                setFilter(option.value);
              }}
              className={`rounded border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                filter === option.value
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-black/15 text-zinc-700 hover:border-accent hover:text-accent-hover"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {isLoadingMessages ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">Nothing here yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {messages.map((message) => {
              const isHandled = message.status === "handled";
              return (
                <li
                  key={message.id}
                  className={`rounded-lg border bg-white p-4 ${
                    isHandled ? "border-black/10 opacity-60" : "border-accent/30"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {message.name || message.email}
                        {message.kind === "rep_application" && message.team_slug ? (
                          <span className="ml-2 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent">
                            {teamName(message.team_slug)} rep
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-zinc-500">
                        <a
                          href={`mailto:${message.email}`}
                          className="font-semibold text-accent hover:text-accent-hover"
                        >
                          {message.email}
                        </a>
                        {" · "}
                        {formatWhen(message.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleHandled(message)}
                      disabled={busyId === message.id}
                      className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-50"
                    >
                      {isHandled ? "Reopen" : "Mark handled"}
                    </button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {message.message}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

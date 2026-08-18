"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminEmailComposer } from "@/components/AdminEmailComposer";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConversationThread } from "@/components/ConversationThread";
import { useAdminAuth } from "@/lib/adminAuth";
import { formatMessageTime } from "@/lib/messages";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { TEAMS } from "@/lib/teams";

// Everything the public has sent in: /contact messages and "Become a team rep"
// applications (see supabase/inbound_messages.sql). The email notification is the
// prompt; this page is the record, so a message that got lost in a spam folder is
// still here.
//
// Answering happens here too, rather than by finding the notification email and
// hitting Reply: the reply goes out through admin-send-email and is written down
// against the message (supabase/inbound_message_replies.sql), so the record
// covers both halves of the conversation instead of just the incoming half.
//
// Two queues, because there are two kinds of sender and only one of them has an
// inbox to read (see supabase/messages.sql):
//
//   Threads  a signed-in member wrote in. Answered right here, on the site, and
//            they see it in /inbox. This is where /contact sends anyone signed
//            in, so over time it becomes the busier of the two.
//   Email    someone with no account, and every rep application. Still answered
//            with the email composer, still recorded against the row.
//
// They are deliberately not merged into one list: the reply mechanism differs,
// and a single stream would invite answering a stranger in a thread they can
// never open.

type InboundReply = {
  id: string;
  body: string;
  sent_to: string;
  created_at: string;
};

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
  // Aggregated by admin_list_inbound_messages; [] for a message never answered.
  replies: InboundReply[] | null;
};

type MemberThread = {
  conversation_id: string;
  member_id: string | null;
  member_name: string | null;
  member_slug: string | null;
  member_email: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_role: string | null;
  message_count: number;
  unread_count: number;
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

const senderLabel = (message: InboundMessage) => message.name || message.email;

function replySubject(message: InboundMessage): string {
  return message.kind === "rep_application" && message.team_slug
    ? `Re: your ${teamName(message.team_slug)} team rep application`
    : "Re: your message to Bobble Shelf";
}

// The reply lands in their inbox from alerts@bobbleshelf.com, possibly days after
// they wrote in, so it carries their own message back with it. Editable like the
// rest of the draft — this is a starting point, not a wrapper.
function quotedOriginal(message: InboundMessage): string {
  const quoted = message.message
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n---\nYou wrote on ${formatWhen(message.created_at)}:\n${quoted}\n`;
}

export default function AdminMessagesPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [threads, setThreads] = useState<MemberThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<InboundMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Returns the read so a caller can report on it afterwards: the success path
  // clears the banner, which would otherwise swallow a message set beforehand.
  const load = useCallback(() => {
    return supabase
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

  const loadThreads = useCallback(
    () =>
      supabase.rpc("admin_list_conversations").then(({ data, error: rpcError }) => {
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setThreads((data ?? []) as MemberThread[]);
        }
        setIsLoadingThreads(false);
      }),
    [],
  );

  useEffect(() => {
    if (!isAdmin) return;
    load();
    void loadThreads();
  }, [isAdmin, load, loadThreads]);

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

  // Called once admin-send-email has accepted the reply, so the mail is already
  // gone by the time we get here. This writes it down against the message — and
  // marks the message handled, which the RPC does in the same statement. A
  // failure here is bookkeeping, not delivery, and the notice says which.
  async function recordReply(message: InboundMessage, body: string) {
    const { error: rpcError } = await supabase.rpc("admin_record_inbound_reply", {
      p_message_id: message.id,
      p_body: body,
    });

    await load();

    if (rpcError) {
      setNotice(null);
      setError(
        `Your reply was sent to ${message.email}, but saving it against the message failed: ${rpcError.message}`,
      );
    } else {
      setError(null);
      setNotice(`Replied to ${senderLabel(message)} — you're BCC'd, and it's saved below.`);
    }
  }

  // Spam and test submissions have no reason to sit in the queue forever, and
  // "handled" only greys them out. Gone for good, hence the second click.
  async function deleteMessage(message: InboundMessage) {
    setBusyId(message.id);
    const { error: rpcError } = await supabase.rpc("admin_delete_inbound_message", {
      p_id: message.id,
    });
    setBusyId(null);
    setConfirmingDeleteId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setError(null);
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
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { label: "Messages" },
          ]}
        />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Messages</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Everything the public has sent in, split by how it can be answered: threads with
          signed-in members, and email from people without an account.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-black uppercase tracking-wide">Threads</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Members who wrote in while signed in. Answer here and it lands in their inbox on the
            site — no email round trip, and they can write back in the same thread.
          </p>

          {isLoadingThreads ? (
            <p className="mt-4 text-sm text-zinc-600">Loading…</p>
          ) : threads.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No member threads yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {threads.map((thread) => {
                const isOpen = openThreadId === thread.conversation_id;
                const name = thread.member_name || thread.member_email || "A collector";
                return (
                  <li
                    key={thread.conversation_id}
                    className={`rounded-lg border bg-white p-4 ${
                      thread.unread_count > 0 ? "border-accent/30" : "border-black/10"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">
                          {name}
                          {thread.unread_count > 0 ? (
                            <span className="ml-2 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent">
                              {thread.unread_count} new
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {thread.member_slug ? (
                            <>
                              <a
                                href={`/shelf/${thread.member_slug}`}
                                className="font-semibold text-accent hover:text-accent-hover"
                              >
                                their shelf
                              </a>
                              {" · "}
                            </>
                          ) : null}
                          {thread.member_email ?? "no address on file"}
                          {" · "}
                          {thread.message_count} {thread.message_count === 1 ? "message" : "messages"}
                          {" · "}
                          {formatMessageTime(thread.last_message_at)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setOpenThreadId(isOpen ? null : thread.conversation_id);
                          // Opening the thread marks it read, so drop the badge
                          // now rather than waiting for a refetch to say so. The
                          // next load confirms it; nothing here decides anything
                          // the database doesn't already agree with.
                          if (!isOpen) {
                            setThreads((current) =>
                              current.map((row) =>
                                row.conversation_id === thread.conversation_id
                                  ? { ...row, unread_count: 0 }
                                  : row,
                              ),
                            );
                          }
                        }}
                        className="shrink-0 rounded border border-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
                      >
                        {isOpen ? "Close" : thread.unread_count > 0 ? "Read and reply" : "Open"}
                      </button>
                    </div>

                    {isOpen ? (
                      <ConversationThread
                        conversationId={thread.conversation_id}
                        otherLabel={name}
                        className="mt-3 max-h-[28rem]"
                        onSent={() => void loadThreads()}
                      />
                    ) : (
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-700">
                        {thread.last_sender_role === "admin" ? "You: " : ""}
                        {thread.last_message_preview ?? "No messages yet"}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <h2 className="mt-10 text-lg font-black uppercase tracking-wide">Email</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Contact-form messages and rep applications from people without an account. These can only
          be answered by email — Reply sends it and keeps a copy against the message.
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
        {notice ? <p className="mt-4 text-sm font-semibold text-green-700">{notice}</p> : null}

        {isLoadingMessages ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">Nothing here yet.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {messages.map((message) => {
              const isHandled = message.status === "handled";
              const replies = message.replies ?? [];
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
                        {senderLabel(message)}
                        {message.kind === "rep_application" && message.team_slug ? (
                          <span className="ml-2 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent">
                            {teamName(message.team_slug)} rep
                          </span>
                        ) : null}
                        {replies.length > 0 ? (
                          <span className="ml-2 rounded bg-green-600/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-700">
                            {replies.length === 1 ? "Replied" : `${replies.length} replies`}
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
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setReplyTo(message);
                        }}
                        disabled={busyId === message.id}
                        className="rounded border border-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-50"
                      >
                        {replies.length > 0 ? "Reply again" : "Reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleHandled(message)}
                        disabled={busyId === message.id}
                        className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-50"
                      >
                        {isHandled ? "Reopen" : "Mark handled"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(message.id)}
                        disabled={busyId === message.id}
                        className="rounded border border-red-500/30 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-red-600 transition hover:border-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                    {message.message}
                  </p>
                  {replies.length > 0 ? (
                    <div className="mt-3 space-y-3 border-l-2 border-accent/40 pl-3">
                      {replies.map((reply) => (
                        <div key={reply.id}>
                          <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                            You replied to {reply.sent_to} · {formatWhen(reply.created_at)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                            {reply.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {confirmingDeleteId === message.id ? (
                    <div className="mt-3 rounded border border-red-500/40 bg-red-50 p-3">
                      <p className="text-xs font-bold text-red-700">
                        Delete this message for good? It won&apos;t be in the queue any more — any
                        replies you sent go with it, and the emails are the only copies left.
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => deleteMessage(message)}
                          disabled={busyId === message.id}
                          className="rounded bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-500 disabled:opacity-50"
                        >
                          {busyId === message.id ? "Deleting…" : "Yes, delete it"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          disabled={busyId === message.id}
                          className="rounded border border-black/15 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:border-accent disabled:opacity-50"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {replyTo ? (
        <AdminEmailComposer
          title="Reply"
          target={{
            kind: "addresses",
            emails: [replyTo.email],
            label: senderLabel(replyTo),
          }}
          initialSubject={replySubject(replyTo)}
          initialBody={quotedOriginal(replyTo)}
          onClose={() => setReplyTo(null)}
          onSent={(_count, sent) => {
            const message = replyTo;
            setReplyTo(null);
            recordReply(message, sent.body);
          }}
        />
      ) : null}
    </main>
  );
}

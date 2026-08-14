"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ModeratorGate } from "@/components/ModeratorGate";
import { avatarPublicUrl } from "@/lib/avatar";
import { type ChatConnection, type ChatMessage, formatChatTime, markChatRead, useChatRoom } from "@/lib/chat";

// The Team Rep Chatroom: one room, everyone who moderates, live.
//
// It sits next to the forum rather than over it — see supabase/chat.sql for
// why both exist. The room is for the quick question; anything worth finding
// again belongs in a thread, and the empty state says so.

function ConnectionPill({ connection }: { connection: ChatConnection }) {
  // Offline is the one worth saying out loud: the room still works (it catches
  // up whenever the tab is focused), but messages won't appear on their own,
  // and someone waiting on a reply should know which they're looking at.
  const label =
    connection === "live" ? "Live" : connection === "connecting" ? "Connecting…" : "Reconnecting…";
  const dotClass =
    connection === "live" ? "bg-green-500" : connection === "connecting" ? "bg-amber-400" : "bg-zinc-400";

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

function MessageRow({
  message,
  canDelete,
  onDelete,
}: {
  message: ChatMessage;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-black/[0.03]">
      <Avatar
        name={message.author_name}
        url={avatarPublicUrl(message.author_avatar_path)}
        className="mt-0.5 h-7 w-7 shrink-0 text-[11px]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">
          <span className="font-semibold text-zinc-700">{message.author_name ?? "Someone"}</span>
          {" · "}
          {formatChatTime(message.created_at)}
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800">
          {message.body}
        </p>
      </div>

      {canDelete ? (
        isConfirming ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] font-black uppercase tracking-wide text-red-600 transition hover:text-red-500"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              className="text-[11px] font-black uppercase tracking-wide text-zinc-500 transition hover:text-zinc-700"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            aria-label="Delete this message"
            // Hidden until hover on a pointer device, but always reachable by
            // keyboard — focus-within on the row would fight the group-hover.
            className="shrink-0 text-xs text-zinc-300 opacity-0 transition focus:opacity-100 group-hover:opacity-100 hover:text-red-500"
          >
            ✕
          </button>
        )
      ) : null}
    </li>
  );
}

function Room() {
  const {
    messages,
    isLoading,
    hasMoreHistory,
    isLoadingHistory,
    connection,
    error,
    myUserId,
    isAdmin,
    send,
    remove,
    loadOlder,
  } = useChatRoom();

  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Whether the reader is at the bottom, sampled *before* the DOM updates —
  // once React has appended the new line, the old scroll position is gone.
  const wasAtBottomRef = useRef(true);
  const lastCountRef = useRef(0);

  // Opening the room is what marks it read; the badge on the dashboard clears
  // on the way back out. Once per visit, like the forum's markTopicRead.
  useEffect(() => {
    markChatRead();
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const grew = messages.length > lastCountRef.current;
    const isFirstPaint = lastCountRef.current === 0 && messages.length > 0;
    lastCountRef.current = messages.length;

    // Land at the bottom on open, and follow along afterwards — but only for
    // someone already reading the bottom. Yanking the view down while they're
    // scrolled up reading history is the classic chat annoyance.
    if (isFirstPaint || (grew && wasAtBottomRef.current)) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages]);

  function rememberScrollPosition() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 80;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || isSending) return;

    setIsSending(true);
    // Cleared optimistically so typing can continue immediately; restored
    // below if the send failed, so nobody loses what they wrote.
    setDraft("");
    wasAtBottomRef.current = true;
    try {
      await send(body);
    } catch {
      setDraft(body);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-8 text-zinc-900 sm:px-8">
      <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-3xl flex-col">
        <div className="flex items-end justify-between gap-3">
          <div>
            <Breadcrumbs
              items={[
                { href: "/", label: "Home" },
                { href: "/admin", label: "Admin" },
                { label: "Chatroom" },
              ]}
            />
            <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Team Rep Chatroom</h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <ConnectionPill connection={connection} />
            <Link
              href="/admin/forum"
              className="text-[11px] font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
            >
              Go to the forum →
            </Link>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

        <div
          ref={scrollerRef}
          onScroll={rememberScrollPosition}
          className="mt-4 flex-1 overflow-y-auto rounded-lg border border-black/10 bg-white p-3"
        >
          {isLoading ? (
            <p className="text-sm text-zinc-600">Loading the room…</p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-black uppercase tracking-wide text-zinc-700">
                Nobody&apos;s said anything yet
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
                This is the room for the quick question — is this listing a dupe, did anyone else
                get this giveaway. Anything worth finding again belongs in{" "}
                <Link href="/admin/forum" className="font-semibold text-accent hover:underline">
                  the forum
                </Link>
                , where it keeps a title.
              </p>
            </div>
          ) : (
            <>
              {hasMoreHistory ? (
                <div className="mb-2 text-center">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={isLoadingHistory}
                    className="rounded border border-black/15 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-600 transition hover:border-accent hover:text-accent-hover disabled:opacity-50"
                  >
                    {isLoadingHistory ? "Loading…" : "Load earlier messages"}
                  </button>
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {messages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    canDelete={isAdmin || (message.author_id !== null && message.author_id === myUserId)}
                    onDelete={() => remove(message.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>

        <form onSubmit={submit} className="mt-3 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Chat convention, and a deliberate break from the forum's
              // classic form submit: Enter sends, Shift+Enter starts a line.
              // IME composition has its own Enter — sending mid-compose would
              // truncate the word being typed.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit(event);
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Message the other reps…"
            className="flex-1 resize-y rounded border border-black/15 px-3 py-2 text-sm leading-6 text-zinc-900 outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={isSending || draft.trim().length === 0}
            className="rounded bg-accent px-4 py-2.5 text-xs font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function AdminChatPage() {
  return (
    <ModeratorGate what="The Team Rep Chatroom">
      <Room />
    </ModeratorGate>
  );
}

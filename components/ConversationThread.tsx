"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { avatarPublicUrl } from "@/lib/avatar";
import { formatMessageTime, useConversation } from "@/lib/messages";

// One thread, read and written. Shared by the member's inbox and the admin
// console, because both sides of a conversation are the same conversation — the
// only difference is who the database says you are, which conversation_send
// works out at write time (see supabase/messages.sql).

function ConnectionNote({ connection }: { connection: "connecting" | "live" | "offline" }) {
  // Only "offline" is worth saying out loud, and even then quietly: the thread
  // still works (it catches up on focus), but a reply won't appear on its own,
  // and someone waiting on one should know which they're looking at.
  if (connection !== "offline") return null;
  return (
    <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-wide text-amber-600">
      Reconnecting — new replies will appear when you come back to this tab
    </p>
  );
}

export function ConversationThread({
  conversationId,
  /** What to call the other side in the empty state and on their lines. */
  otherLabel,
  className,
  onSent,
}: {
  conversationId: string;
  otherLabel: string;
  className?: string;
  /** Fired after a send lands, for a list that shows previews or unread counts. */
  onSent?: () => void;
}) {
  const { messages, isLoading, hasMoreHistory, isLoadingHistory, connection, error, myUserId, send, loadOlder } =
    useConversation(conversationId);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messageCount = messages.length;

  // Pin to the newest line on open and as messages land, the way every thread
  // is expected to behave. Layout effect so it doesn't flash the top first.
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  // A fresh thread clears whatever was half-typed in the previous one. Compared
  // during render (components/Avatar.tsx's pattern) rather than in an effect, so
  // the box is never briefly wrong.
  const [drafting, setDrafting] = useState(conversationId);
  if (drafting !== conversationId) {
    setDrafting(conversationId);
    setDraft("");
  }

  const submit = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    try {
      await send(body);
      setDraft("");
      onSent?.();
    } catch {
      // useConversation surfaces it; the draft stays put so nothing is lost.
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={`flex min-h-0 flex-col ${className ?? ""}`}>
      <div className="min-h-0 flex-1 overflow-y-auto px-1">
        {isLoading ? (
          <p className="py-6 text-sm text-zinc-600">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="py-6 text-sm text-zinc-600">
            Nothing here yet — say hello to {otherLabel}.
          </p>
        ) : (
          <>
            {hasMoreHistory ? (
              <div className="py-3 text-center">
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={isLoadingHistory}
                  className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:opacity-50"
                >
                  {isLoadingHistory ? "Loading…" : "Earlier messages"}
                </button>
              </div>
            ) : null}
            <ul className="space-y-3 py-3">
              {messages.map((message) => {
                const isMine = Boolean(myUserId) && message.sender_id === myUserId;
                const isStaff = message.sender_role === "admin";
                const who = isMine ? "You" : isStaff ? otherLabel : (message.sender_name ?? otherLabel);
                return (
                  <li key={message.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                    {isStaff ? (
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-black uppercase text-accent-fg"
                      >
                        BS
                      </span>
                    ) : (
                      <Avatar
                        name={who}
                        url={avatarPublicUrl(message.sender_avatar_path)}
                        className="h-8 w-8 shrink-0 text-xs"
                      />
                    )}
                    <div className={`min-w-0 max-w-[85%] ${isMine ? "text-right" : ""}`}>
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
                        {who} · {formatMessageTime(message.created_at)}
                      </p>
                      <p
                        className={`mt-1 inline-block whitespace-pre-wrap rounded-lg px-3 py-2 text-left text-sm leading-6 ${
                          isMine ? "bg-accent/10 text-zinc-900" : "bg-white text-zinc-800 shadow-sm"
                        }`}
                      >
                        {message.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="px-1 py-2 text-sm font-semibold text-red-600">{error}</p> : null}
      <ConnectionNote connection={connection} />

      <form
        className="flex items-end gap-2 border-t border-black/10 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="sr-only" htmlFor="message-draft">
          Your message
        </label>
        <textarea
          id="message-draft"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line — what every messaging
            // box does, and the reason the send button stays for touch.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Write a message…"
          className="min-h-[2.75rem] flex-1 resize-y rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isSending || draft.trim().length === 0}
          className="rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-50"
        >
          {isSending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

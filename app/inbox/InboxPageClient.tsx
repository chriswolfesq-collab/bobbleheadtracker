"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConversationThread } from "@/components/ConversationThread";
import { avatarPublicUrl } from "@/lib/avatar";
import { useAuth } from "@/lib/auth";
import { formatMessageTime, messageAdmin, useInbox } from "@/lib/messages";

// Every member's inbox. Stage 1 has one kind of thread in it — yours with the
// admins — so the list looks thin on purpose; Stage 2 fills it with
// member-to-member without this file changing much: inbox_list already returns
// the other party's name, slug and avatar for a direct thread.
//
// Two panes on a wide screen, one at a time on a narrow one, which is why the
// selection lives here rather than in the URL: a thread is not a page anyone
// links to, and keeping it in state means switching threads doesn't push
// history entries a Back button then has to walk through.

export function InboxPageClient() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const { conversations, isLoading, error, reload } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Open the newest thread on a wide screen so the pane isn't empty on arrival.
  // Narrow screens keep the list, since the thread would cover it.
  useEffect(() => {
    if (selectedId || conversations.length === 0) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      // Deliberately in an effect: the answer depends on the viewport, which the
      // server render can't know, and deriving it during render would hydrate
      // differently than it rendered. Same reason UpcomingCountdown and
      // lib/listingTrail reach for this.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(conversations[0].conversation_id);
    }
  }, [conversations, selectedId]);

  const selected = conversations.find((c) => c.conversation_id === selectedId) ?? null;
  const hasAdminThread = conversations.some((c) => c.kind === "admin");

  const startAdminThread = async () => {
    const body = draft.trim();
    if (!body || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const conversationId = await messageAdmin(body);
      setDraft("");
      await reload();
      setSelectedId(conversationId);
    } catch (caught) {
      setStartError(caught instanceof Error ? caught.message : "That didn't send.");
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoadingAuth) return null;

  if (!user) {
    return (
      <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
        <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">Inbox</h1>
          <p className="mt-4 rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
            Sign in to read your messages. If you don&apos;t have an account, the{" "}
            <Link href="/contact" className="font-semibold text-accent hover:text-accent-hover">
              contact form
            </Link>{" "}
            reaches us by email instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <Breadcrumbs className="mb-6" items={[{ href: "/", label: "Home" }, { label: "Inbox" }]} />
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">Inbox</h1>

        {error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}

        {isLoading ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {/* The list. Hidden on a narrow screen once a thread is open. */}
            <div className={selected ? "hidden lg:block" : ""}>
              {conversations.length === 0 ? (
                <p className="rounded-xl border border-border-soft bg-surface p-6 text-sm leading-7 text-zinc-700">
                  No messages yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {conversations.map((conversation) => {
                    const isSelected = conversation.conversation_id === selectedId;
                    return (
                      <li key={conversation.conversation_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(conversation.conversation_id)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-accent bg-accent/5"
                              : "border-border-soft bg-surface hover:border-accent"
                          }`}
                        >
                          {conversation.kind === "admin" ? (
                            <span
                              aria-hidden
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-[10px] font-black uppercase text-accent-fg"
                            >
                              BS
                            </span>
                          ) : (
                            <Avatar
                              name={conversation.title}
                              url={avatarPublicUrl(conversation.other_avatar_path)}
                              className="h-9 w-9 shrink-0 text-sm"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-bold text-navy">{conversation.title}</span>
                              <span className="shrink-0 text-[11px] text-zinc-500">
                                {formatMessageTime(conversation.last_message_at)}
                              </span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-2">
                              <span className="line-clamp-1 flex-1 text-xs text-zinc-600">
                                {conversation.last_sender_role === "member" && conversation.kind === "admin"
                                  ? "You: "
                                  : ""}
                                {conversation.last_message_preview ?? "No messages yet"}
                              </span>
                              {conversation.unread_count > 0 ? (
                                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-accent-fg">
                                  {conversation.unread_count}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Starting the admin thread. Only offered when there isn't one —
                  after that it's in the list and gets replied to like anything
                  else. */}
              {!hasAdminThread ? (
                <div className="mt-4 rounded-xl border border-border-soft bg-surface p-4">
                  <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                    Message the admins
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    Questions about your account, a listing, or a photo — this reaches us here rather
                    than by email.
                  </p>
                  <textarea
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="What's going on?"
                    className="mt-3 w-full resize-y rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
                  />
                  {startError ? (
                    <p className="mt-2 text-sm font-semibold text-red-600">{startError}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void startAdminThread()}
                    disabled={isStarting || draft.trim().length === 0}
                    className="mt-3 rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-50"
                  >
                    {isStarting ? "Sending…" : "Send message"}
                  </button>
                </div>
              ) : null}
            </div>

            {/* The thread. */}
            {selected ? (
              <div className="flex min-h-[28rem] flex-col rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3">
                  <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
                    {selected.title}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded border border-black/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover lg:hidden"
                  >
                    Back
                  </button>
                </div>
                <ConversationThread
                  conversationId={selected.conversation_id}
                  otherLabel={selected.title}
                  className="min-h-0 flex-1 pt-3"
                  onSent={() => void reload()}
                />
              </div>
            ) : (
              <div className="hidden rounded-xl border border-border-soft bg-surface p-6 text-sm text-zinc-600 lg:block">
                Pick a conversation to read it.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

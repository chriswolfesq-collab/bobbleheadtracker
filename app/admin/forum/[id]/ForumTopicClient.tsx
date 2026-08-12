"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ModeratorGate } from "@/components/ModeratorGate";
import { useAdminAuth } from "@/lib/adminAuth";
import {
  deleteReply,
  deleteTopic,
  editReply,
  editTopic,
  formatForumTime,
  getTopic,
  listReplies,
  markTopicRead,
  postReply,
  setTopicLocked,
  setTopicPinned,
  type ForumReply,
  type ForumTopic,
} from "@/lib/forum";
import { TEAMS } from "@/lib/teams";

// One thread: the opening post, its replies in order, and the box to add
// another. Opening the page marks the thread read (supabase/mod_forum.sql), so
// arriving here from the digest email is what clears its unread dot.

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

const buttonClass =
  "rounded border border-black/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-600 transition hover:border-accent hover:text-accent-hover disabled:opacity-50";

function Byline({
  name,
  when,
  editedAt,
}: {
  name: string | null;
  when: string;
  editedAt: string | null;
}) {
  return (
    <p className="text-xs text-zinc-500">
      <span className="font-semibold text-zinc-700">{name ?? "Someone"}</span>
      {" · "}
      {formatForumTime(when)}
      {/* An edited post says so. Silently rewriting what someone replied to is
          the one thing a small trusted board can't afford. */}
      {editedAt ? <span className="text-zinc-400"> · edited</span> : null}
    </p>
  );
}

function PostBody({ body }: { body: string }) {
  return <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-800">{body}</p>;
}

function Thread({ topicId }: { topicId: string }) {
  const { user, isAdmin } = useAdminAuth();
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  // Which post is open in an editor, and the draft in it. One at a time: two
  // simultaneous edits on the same page is a conflict nobody asked for.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getTopic(topicId), listReplies(topicId)])
      .then(([loadedTopic, loadedReplies]) => {
        setTopic(loadedTopic);
        setReplies(loadedReplies);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Couldn't load this thread.");
      })
      .finally(() => setIsLoadingThread(false));
  }, [topicId]);

  useEffect(load, [load]);

  // Separate from the load: marking read is a write, it doesn't gate the render,
  // and it should happen once per visit rather than on every refresh after a
  // reply. Ordering doesn't matter — the mark is stamped with now().
  useEffect(() => {
    markTopicRead(topicId);
  }, [topicId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    const body = replyBody;
    await run(async () => {
      await postReply(topicId, body);
      setReplyBody("");
    });
  }

  function startEditingTopic() {
    if (!topic) return;
    setEditingId(topic.id);
    setDraftTitle(topic.title);
    setDraftBody(topic.body);
  }

  function startEditingReply(reply: ForumReply) {
    setEditingId(reply.id);
    setDraftBody(reply.body);
  }

  function canEdit(authorId: string | null) {
    return isAdmin || (authorId !== null && authorId === user?.id);
  }

  if (isLoadingThread) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
        <p className="mx-auto max-w-3xl text-sm text-zinc-600">Loading…</p>
      </main>
    );
  }

  if (!topic) {
    return (
      <main className="min-h-full bg-slate-50 px-4 py-10 text-center text-zinc-900">
        <p className="text-sm font-black uppercase tracking-wide">Topic not found</p>
        <p className="mt-2 text-sm text-zinc-600">
          It may have been deleted since the link was sent.
        </p>
        <Link
          href="/admin/forum"
          className="mt-6 inline-block rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover"
        >
          Back to the board
        </Link>
      </main>
    );
  }

  const isEditingTopic = editingId === topic.id;

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { href: "/admin/forum", label: "Forum" },
            { label: topic.title },
          ]}
        />

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <article className="mt-4 rounded-lg border border-black/10 bg-white p-5">
          {isEditingTopic ? (
            <>
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                maxLength={140}
                className="w-full rounded border border-black/15 px-3 py-2 text-sm font-semibold outline-none focus:border-accent"
              />
              <textarea
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
                rows={8}
                maxLength={8000}
                className="mt-3 w-full resize-y rounded border border-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-accent"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await editTopic(topic.id, draftTitle, draftBody);
                      setEditingId(null);
                    })
                  }
                  className="rounded bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-50"
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={buttonClass}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">{topic.title}</h1>
                {topic.pinned ? (
                  <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent">
                    Pinned
                  </span>
                ) : null}
                {topic.locked ? (
                  <span className="rounded bg-black/[0.06] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">
                    Locked
                  </span>
                ) : null}
                {topic.team_slug ? (
                  <span className="rounded bg-black/[0.06] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-600">
                    {teamName(topic.team_slug)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1">
                <Byline
                  name={topic.author_name}
                  when={topic.created_at}
                  editedAt={topic.edited_at}
                />
              </div>
              <PostBody body={topic.body} />
            </>
          )}

          {!isEditingTopic ? (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-3">
              {canEdit(topic.author_id) ? (
                <>
                  <button type="button" onClick={startEditingTopic} className={buttonClass}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(topic.id)}
                    className={buttonClass}
                  >
                    Delete
                  </button>
                </>
              ) : null}
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setTopicPinned(topic.id, !topic.pinned))}
                    className={buttonClass}
                  >
                    {topic.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => setTopicLocked(topic.id, !topic.locked))}
                    className={buttonClass}
                  >
                    {topic.locked ? "Unlock" : "Lock"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {confirmingDeleteId === topic.id ? (
            <div className="mt-3 rounded border border-red-500/40 bg-red-50 p-3">
              <p className="text-xs font-bold text-red-700">
                Delete this topic and all {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}? Other people&apos;s posts go with it.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await deleteTopic(topic.id);
                      window.location.assign("/admin/forum");
                    })
                  }
                  className="rounded bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  Yes, delete it
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteId(null)}
                  className={buttonClass}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : null}
        </article>

        {replies.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {replies.map((reply) => (
              <li key={reply.id} className="rounded-lg border border-black/10 bg-white p-4">
                {editingId === reply.id ? (
                  <>
                    <textarea
                      value={draftBody}
                      onChange={(event) => setDraftBody(event.target.value)}
                      rows={5}
                      maxLength={8000}
                      className="w-full resize-y rounded border border-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-accent"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await editReply(reply.id, draftBody);
                            setEditingId(null);
                          })
                        }
                        className="rounded bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={buttonClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Byline
                      name={reply.author_name}
                      when={reply.created_at}
                      editedAt={reply.edited_at}
                    />
                    <PostBody body={reply.body} />
                    {canEdit(reply.author_id) ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingReply(reply)}
                          className={buttonClass}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(reply.id)}
                          className={buttonClass}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                    {confirmingDeleteId === reply.id ? (
                      <div className="mt-3 rounded border border-red-500/40 bg-red-50 p-3">
                        <p className="text-xs font-bold text-red-700">Delete this reply?</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await deleteReply(reply.id);
                                setConfirmingDeleteId(null);
                              })
                            }
                            className="rounded bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-500 disabled:opacity-50"
                          >
                            Yes, delete it
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className={buttonClass}
                          >
                            Keep it
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {topic.locked ? (
          <p className="mt-4 rounded-lg border border-black/10 bg-white p-4 text-sm text-zinc-600">
            This topic is locked. It stays readable, but no new replies.
          </p>
        ) : (
          <form onSubmit={submitReply} className="mt-4 rounded-lg border border-black/10 bg-white p-4">
            <textarea
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              placeholder="Reply…"
              rows={4}
              maxLength={8000}
              className="w-full resize-y rounded border border-black/15 px-3 py-2 text-sm leading-6 outline-none focus:border-accent"
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={busy || replyBody.trim().length === 0}
                className="rounded bg-accent px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-50"
              >
                {busy ? "Posting…" : "Reply"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export function ForumTopicClient({ topicId }: { topicId: string }) {
  return (
    <ModeratorGate>
      <Thread topicId={topicId} />
    </ModeratorGate>
  );
}

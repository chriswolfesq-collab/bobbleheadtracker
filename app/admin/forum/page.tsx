"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ForumImagePicker } from "@/components/ForumImagePicker";
import { ModeratorGate } from "@/components/ModeratorGate";
import { useAdminAuth } from "@/lib/adminAuth";
import { avatarPublicUrl } from "@/lib/avatar";
import { createTopic, formatForumTime, listTopics, type ForumTopicListing } from "@/lib/forum";
import { removeForumImages, uploadForumImage } from "@/lib/forumImages";
import { TEAMS } from "@/lib/teams";

// The board: every thread admins and team reps can see, newest activity first
// with pinned topics held at the top. See supabase/mod_forum.sql for why this
// is a forum rather than a chatroom.

type Filter = "all" | "unread";

const teamName = (slug: string) => TEAMS.find((t) => t.slug === slug)?.name ?? slug;

function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
        tone === "accent" ? "bg-accent/10 text-accent" : "bg-black/[0.06] text-zinc-600"
      }`}
    >
      {children}
    </span>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const { user, editableTeams, isAdmin } = useAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An admin can be talking about any team; a rep is almost always talking
  // about one of theirs, so their list is the short one. Either way the label
  // is optional — plenty of threads aren't about a single team.
  const teamOptions = isAdmin ? TEAMS.map((t) => t.slug) : editableTeams;

  function reset() {
    setTitle("");
    setBody("");
    setTeamSlug("");
    setImageFile(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // The image goes up first so the topic row can carry its path. If the
      // topic insert then fails, sweep the fresh upload — otherwise retrying
      // the post would stack orphans in the bucket.
      let imagePath: string | null = null;
      if (imageFile && user) {
        const uploaded = await uploadForumImage(user.id, imageFile);
        if (uploaded.error) throw new Error(uploaded.error);
        imagePath = uploaded.path;
      }

      try {
        await createTopic({ title, body, teamSlug: teamSlug || null, imagePath });
      } catch (caught) {
        if (imagePath) void removeForumImages([imagePath]);
        throw caught;
      }
      reset();
      setIsOpen(false);
      onPosted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't post that. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-lg border border-dashed border-black/20 bg-white px-4 py-3 text-sm font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
      >
        Start a topic
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-accent/30 bg-white p-4">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What's this about?"
        maxLength={140}
        autoFocus
        className="w-full rounded border border-black/15 px-3 py-2 text-sm font-semibold text-zinc-900 outline-none focus:border-accent"
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Say more…"
        rows={6}
        maxLength={8000}
        className="mt-3 w-full resize-y rounded border border-black/15 px-3 py-2 text-sm leading-6 text-zinc-800 outline-none focus:border-accent"
      />

      <ForumImagePicker file={imageFile} onSelect={setImageFile} disabled={isSaving} />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-[11px] font-black uppercase tracking-wide text-zinc-500">
          Team
          <select
            value={teamSlug}
            onChange={(event) => setTeamSlug(event.target.value)}
            className="ml-2 rounded border border-black/15 px-2 py-1 text-xs font-semibold text-zinc-800 outline-none focus:border-accent"
          >
            <option value="">Not team-specific</option>
            {teamOptions.map((slug) => (
              <option key={slug} value={slug}>
                {teamName(slug)}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setIsOpen(false);
            }}
            disabled={isSaving}
            className="rounded border border-black/15 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:border-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || title.trim().length < 3 || body.trim().length === 0}
            className="rounded bg-accent px-4 py-1.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {isSaving ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

function Board() {
  const [topics, setTopics] = useState<ForumTopicListing[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listTopics()
      .then((rows) => {
        setTopics(rows);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Couldn't load the board.");
      })
      .finally(() => setIsLoadingTopics(false));
  }, []);

  useEffect(load, [load]);

  const unreadCount = topics.filter((topic) => topic.unread).length;
  const shown = filter === "unread" ? topics.filter((topic) => topic.unread) : topics;

  return (
    <main className="min-h-full bg-slate-50 px-4 py-10 text-zinc-900">
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/admin", label: "Admin" },
            { label: "Team Rep Forum" },
          ]}
        />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-wide">Team Rep Forum</h1>
        <p className="mt-1 text-sm text-zinc-600">
          A private board for admins and team reps — questions about the queue, how we&apos;re
          tagging things, a promo that ran in two cities. Everyone who moderates sees every thread.
        </p>

        <div className="mt-6">
          <Composer onPosted={load} />
        </div>

        <div className="mt-6 flex items-center gap-2">
          {(["all", "unread"] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`rounded border px-3 py-1.5 text-xs font-black uppercase tracking-wide transition ${
                filter === option
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-black/15 text-zinc-700 hover:border-accent hover:text-accent-hover"
              }`}
            >
              {option === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {isLoadingTopics ? (
          <p className="mt-6 text-sm text-zinc-600">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600">
            {filter === "unread"
              ? "You're caught up."
              : "No topics yet. Start the first one above."}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {shown.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/admin/forum/${topic.id}`}
                  className={`block rounded-lg border bg-white p-4 transition hover:border-accent/60 ${
                    topic.unread ? "border-accent/30" : "border-black/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* The dot carries the unread state on its own; the row is
                        a link, so bolding the title would fight the hover. */}
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                        topic.unread ? "bg-accent" : "bg-transparent"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900">{topic.title}</p>
                        {topic.pinned ? <Chip tone="accent">Pinned</Chip> : null}
                        {topic.locked ? <Chip>Locked</Chip> : null}
                        {topic.team_slug ? <Chip>{teamName(topic.team_slug)}</Chip> : null}
                        {topic.unread ? <span className="sr-only">Unread</span> : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Avatar
                          name={topic.author_name}
                          url={avatarPublicUrl(topic.author_avatar_path)}
                          className="h-5 w-5 text-[9px]"
                        />
                        <span className="truncate">
                          {topic.author_name ?? "Someone"}
                          {" · "}
                          {topic.reply_count === 0
                            ? "no replies"
                            : `${topic.reply_count} ${topic.reply_count === 1 ? "reply" : "replies"}`}
                          {" · "}
                          {formatForumTime(topic.last_activity_at)}
                        </span>
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default function AdminForumPage() {
  return (
    <ModeratorGate>
      <Board />
    </ModeratorGate>
  );
}

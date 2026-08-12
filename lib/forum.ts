"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { submissionError } from "@/lib/rateLimit";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// The moderators' forum — see supabase/mod_forum.sql for the schema and the
// reasoning. Every call here is an RPC rather than a table read or write: the
// tables have SELECT policies only, and the unread flag each list carries is a
// join against the caller's own read marks that has to happen server-side.

export type ForumTopic = {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  team_slug: string | null;
  pinned: boolean;
  locked: boolean;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  edited_at: string | null;
};

/** A topic as the list page sees it: the row plus whether this reader is
 *  behind on it. */
export type ForumTopicListing = ForumTopic & { unread: boolean };

export type ForumReply = {
  id: string;
  topic_id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  edited_at: string | null;
};

/** Shared by the board and the thread view so a timestamp doesn't read two
 *  different ways one click apart. Same shape as the other admin pages: short
 *  and local, with the year only once it stops being obvious. */
export function formatForumTime(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function listTopics(): Promise<ForumTopicListing[]> {
  const { data, error } = await supabase.rpc("forum_list_topics");
  if (error) throw submissionError(error);
  return (data ?? []) as ForumTopicListing[];
}

export async function getTopic(id: string): Promise<ForumTopic | null> {
  const { data, error } = await supabase.rpc("forum_get_topic", { p_id: id });
  if (error) throw submissionError(error);
  const rows = (data ?? []) as ForumTopic[];
  return rows[0] ?? null;
}

export async function listReplies(topicId: string): Promise<ForumReply[]> {
  const { data, error } = await supabase.rpc("forum_list_replies", { p_topic_id: topicId });
  if (error) throw submissionError(error);
  return (data ?? []) as ForumReply[];
}

export async function createTopic(input: {
  title: string;
  body: string;
  teamSlug?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("forum_create_topic", {
    p_title: input.title,
    p_body: input.body,
    // Omitted rather than sent as null: the RPC's p_team_slug defaults to null
    // already, and supabase-js types an optional argument as `string | undefined`.
    p_team_slug: input.teamSlug ?? undefined,
  });
  if (error) throw submissionError(error);
  return data as string;
}

export async function postReply(topicId: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc("forum_reply", {
    p_topic_id: topicId,
    p_body: body,
  });
  if (error) throw submissionError(error);
  return data as string;
}

export async function editTopic(id: string, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("forum_edit_topic", {
    p_id: id,
    p_title: title,
    p_body: body,
  });
  if (error) throw submissionError(error);
}

export async function editReply(id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("forum_edit_reply", { p_id: id, p_body: body });
  if (error) throw submissionError(error);
}

export async function deleteTopic(id: string): Promise<void> {
  const { error } = await supabase.rpc("forum_delete_topic", { p_id: id });
  if (error) throw submissionError(error);
}

export async function deleteReply(id: string): Promise<void> {
  const { error } = await supabase.rpc("forum_delete_reply", { p_id: id });
  if (error) throw submissionError(error);
}

export async function setTopicPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc("forum_set_pinned", { p_id: id, p_pinned: pinned });
  if (error) throw submissionError(error);
}

export async function setTopicLocked(id: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc("forum_set_locked", { p_id: id, p_locked: locked });
  if (error) throw submissionError(error);
}

// Fire-and-forget: opening a thread marks it read, and a failure there is not
// worth an error banner over the thread you're already reading. The badge
// simply stays up until the next successful open.
export async function markTopicRead(topicId: string): Promise<void> {
  const { error } = await supabase.rpc("forum_mark_read", { p_topic_id: topicId });
  if (error) console.error("Failed to mark the topic read:", error.message);
}

/**
 * How many threads this moderator is behind on. Its own round trip rather than
 * a length check over listTopics(), because the only caller that needs it —
 * the admin dashboard tile — doesn't otherwise load the board.
 */
export function useForumUnreadCount(): { count: number; refresh: () => void } {
  const { isAdmin, isRep, isLoading } = useAdminAuth();
  const canAccess = isAdmin || isRep;
  const [count, setCount] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (isLoading || !canAccess) return;

    let cancelled = false;

    supabase.rpc("forum_unread_count").then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to count unread forum topics:", error.message);
        return;
      }
      setCount(typeof data === "number" ? data : 0);
    });

    return () => {
      cancelled = true;
    };
  }, [canAccess, isLoading, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { count, refresh };
}

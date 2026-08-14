"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { submissionError } from "@/lib/rateLimit";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// The Team Rep Chatroom — see supabase/chat.sql for the schema and the
// reasoning. Same RPC-only shape as lib/forum.ts: the table has a SELECT
// policy and nothing else, so every write is a security definer function.
//
// This is the one place in the app that opens a realtime socket. It's
// deliberately not load-bearing: an insert event carries a row, but all this
// does with it is call chat_new_messages() for anything it hasn't seen. So the
// rendered message always comes from the same RPC with the same live avatar
// join, and a socket that never connects (or drops on a flaky connection)
// leaves a room that still catches up whenever the tab is focused — the
// refetch-on-visibility pattern used by useAdminQueueCounts and lib/referrals.

export type ChatMessage = {
  id: string;
  body: string;
  author_id: string | null;
  /** Stamped at write time so the room stays readable after an account goes. */
  author_name: string | null;
  /** Joined live from profiles, like the forum's — a changed photo follows its
   *  owner onto old lines. */
  author_avatar_path: string | null;
  created_at: string;
};

export type ChatConnection = "connecting" | "live" | "offline";

/** Clock-style time for a room where everything is from today; the date joins
 *  in once a message is old enough for "3:42 PM" to be ambiguous. */
export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();

  return date.toLocaleString(undefined, {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function sendChatMessage(body: string): Promise<ChatMessage> {
  const { data, error } = await supabase.rpc("chat_send", { p_body: body });
  if (error) throw submissionError(error);
  const row = (data ?? [])[0];
  if (!row) throw new Error("The message didn't send. Try again.");
  return row as ChatMessage;
}

export async function deleteChatMessage(id: string): Promise<void> {
  const { error } = await supabase.rpc("chat_delete_message", { p_id: id });
  if (error) throw submissionError(error);
}

/** Fire-and-forget, like the forum's markTopicRead: it doesn't gate any render
 *  and a failed mark just means the badge lingers one visit longer. */
export function markChatRead(): void {
  supabase.rpc("chat_mark_read").then(({ error }) => {
    if (error) console.error("Failed to mark the chatroom read:", error.message);
  });
}

/**
 * The room: the loaded messages, how the live connection is doing, and the
 * actions the page needs. Messages are held oldest-first, the order they're
 * rendered in.
 */
export function useChatRoom() {
  const { isAdmin, isRep, isLoading, user } = useAdminAuth();
  const canAccess = isAdmin || isRep;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [connection, setConnection] = useState<ChatConnection>("connecting");
  const [error, setError] = useState<string | null>(null);

  // The catch-up cursor. A ref rather than state because the realtime callback
  // and the visibility listener both need today's value without re-subscribing
  // every time a message lands.
  const newestAtRef = useRef<string | null>(null);

  // Merge by id, keeping the room sorted. The same message can arrive twice —
  // sender's own RPC result, then the realtime-triggered catch-up — and
  // deduping here is what lets both paths stay simple.
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      const next = Array.from(byId.values()).sort((a, b) =>
        a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at < b.created_at ? -1 : 1,
      );
      const newest = next[next.length - 1];
      if (newest && (!newestAtRef.current || newest.created_at > newestAtRef.current)) {
        newestAtRef.current = newest.created_at;
      }
      return next;
    });
  }, []);

  const catchUp = useCallback(async () => {
    const since = newestAtRef.current;
    if (!since) return;
    const { data, error: catchUpError } = await supabase.rpc("chat_new_messages", {
      p_since: since,
    });
    if (catchUpError) {
      console.error("Failed to catch up on the chatroom:", catchUpError.message);
      return;
    }
    merge((data ?? []) as ChatMessage[]);
  }, [merge]);

  // First load.
  useEffect(() => {
    if (isLoading || !canAccess) return;

    let cancelled = false;

    supabase.rpc("chat_list_messages", { p_before: undefined }).then(({ data, error: loadError }) => {
      if (cancelled) return;
      if (loadError) {
        setError(submissionError(loadError).message);
      } else {
        const rows = (data ?? []) as ChatMessage[];
        merge(rows);
        // A full page back means there's probably more behind it.
        setHasMoreHistory(rows.length >= 100);
      }
      setIsLoadingRoom(false);
    });

    return () => {
      cancelled = true;
    };
  }, [canAccess, isLoading, merge]);

  // The live socket. Subscribed once per session in the room; the insert
  // payload is only a nudge — see the note at the top of this file.
  useEffect(() => {
    if (isLoading || !canAccess) return;

    const channel = supabase
      .channel("team-rep-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        void catchUp();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (payload) => {
        // Default replica identity sends the primary key only, which is all
        // that's needed to drop the line.
        const removedId = (payload.old as { id?: string } | null)?.id;
        if (removedId) setMessages((current) => current.filter((m) => m.id !== removedId));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("live");
          // A reconnect can straddle messages sent while the socket was down.
          void catchUp();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canAccess, isLoading, catchUp]);

  // The safety net, and the reason a dead socket is survivable: coming back to
  // the tab catches the room up regardless. Unthrottled, unlike the queue
  // counts' once-a-minute nudge — this is the one screen where being current
  // is the whole point.
  useEffect(() => {
    if (!canAccess) return;

    function handleWake() {
      if (document.visibilityState !== "visible") return;
      void catchUp();
    }

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    return () => {
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
    };
  }, [canAccess, catchUp]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || isLoadingHistory) return;
    setIsLoadingHistory(true);
    const { data, error: historyError } = await supabase.rpc("chat_list_messages", {
      p_before: oldest.created_at,
    });
    if (historyError) {
      setError(submissionError(historyError).message);
    } else {
      const rows = (data ?? []) as ChatMessage[];
      merge(rows);
      setHasMoreHistory(rows.length >= 100);
    }
    setIsLoadingHistory(false);
  }, [messages, isLoadingHistory, merge]);

  const send = useCallback(
    async (body: string) => {
      setError(null);
      try {
        // Merged straight in rather than waited for: the sender shouldn't be
        // the last person to see their own message if the socket is down.
        merge([await sendChatMessage(body)]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That didn't send.");
        throw caught;
      }
    },
    [merge],
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteChatMessage(id);
        setMessages((current) => current.filter((message) => message.id !== id));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Couldn't delete that.");
      }
    },
    [],
  );

  return {
    messages,
    isLoading: isLoading || isLoadingRoom,
    hasMoreHistory,
    isLoadingHistory,
    connection,
    error,
    myUserId: user?.id ?? null,
    isAdmin,
    send,
    remove,
    loadOlder,
  };
}

/** Messages posted since this reader last opened the room — the dashboard
 *  badge. Same nonce-refresh shape as useForumUnreadCount. */
export function useChatUnreadCount() {
  const { isAdmin, isRep, isLoading } = useAdminAuth();
  const canAccess = isAdmin || isRep;
  const [count, setCount] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (isLoading || !canAccess) return;

    let cancelled = false;

    supabase.rpc("chat_unread_count").then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to count unread chat messages:", error.message);
        return;
      }
      setCount(data ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [canAccess, isLoading, nonce]);

  const refresh = useCallback(() => setNonce((current) => current + 1), []);

  return { count: canAccess ? count : 0, refresh };
}

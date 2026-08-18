"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { submissionError } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";

// On-site messages — see supabase/messages.sql for the schema and the
// reasoning. Same RPC-only shape as lib/chat.ts and lib/forum.ts: the message
// table has a SELECT policy and nothing else, so every write is a security
// definer function.
//
// The realtime socket here is deliberately not load-bearing, for the reason
// spelled out in lib/chat.ts: an insert event is only a nudge to call
// conversation_new_messages(). One read path, one live profile join, and a
// socket that never connects degrades to catching up whenever the tab is
// focused rather than showing nothing.
//
// The formatter is a local copy rather than an import from lib/chat: that
// module's hooks pull useAdminAuth in with them, and the inbox is the one place
// in the app where every signed-in member loads the code.

export type MessageRole = "member" | "admin";

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  body: string;
  sender_id: string | null;
  sender_role: MessageRole;
  /** Null on a staff line: those render as the site, not as a person. */
  sender_name: string | null;
  sender_avatar_path: string | null;
  created_at: string;
};

export type InboxConversation = {
  conversation_id: string;
  kind: "admin" | "direct";
  title: string;
  other_slug: string | null;
  other_avatar_path: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  last_sender_role: MessageRole | null;
  unread_count: number;
};

export type MessageConnection = "connecting" | "live" | "offline";

/** Clock time for today, date once "3:42 PM" would be ambiguous. */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();

  return date.toLocaleString(undefined, {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function sendMessage(conversationId: string, body: string): Promise<ConversationMessage> {
  const { data, error } = await supabase.rpc("conversation_send", {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) throw submissionError(error);
  const row = (data ?? [])[0];
  if (!row) throw new Error("The message didn't send. Try again.");
  return row as ConversationMessage;
}

/** Opens the caller's thread with the admins on first use, continues it after.
 *  Returns the conversation id so the caller can navigate into it. */
export async function messageAdmin(body: string): Promise<string> {
  const { data, error } = await supabase.rpc("message_admin", { p_body: body });
  if (error) throw submissionError(error);
  if (!data) throw new Error("The message didn't send. Try again.");
  return data as string;
}

/** Fire-and-forget, like markChatRead: it gates no render, and a failed mark
 *  just means the badge lingers one visit longer. */
export function markConversationRead(conversationId: string): void {
  supabase.rpc("conversation_mark_read", { p_conversation_id: conversationId }).then(({ error }) => {
    if (error) console.error("Failed to mark the conversation read:", error.message);
  });
}

/** The conversation list. Reloads on a realtime nudge and on tab focus, so a
 *  reply lands in the list without a manual refresh. */
export function useInbox() {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      supabase.rpc("inbox_list").then(({ data, error: loadError }) => {
        if (loadError) {
          setError(submissionError(loadError).message);
        } else {
          setError(null);
          setConversations((data ?? []) as InboxConversation[]);
        }
        setIsLoading(false);
      }),
    [],
  );

  useEffect(() => {
    if (isLoadingAuth || !user) return;
    void load();
  }, [isLoadingAuth, user, load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        () => void load(),
      )
      .subscribe();

    function handleWake() {
      if (document.visibilityState !== "visible") return;
      void load();
    }

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
    };
  }, [user, load]);

  return { conversations, isLoading: isLoadingAuth || isLoading, error, reload: load };
}

/**
 * One thread: the loaded messages, how the live connection is doing, and the
 * actions the view needs. Messages are held oldest-first, the order they render
 * in. Mirrors useChatRoom, minus the moderator gate — access is decided in the
 * database by can_read_conversation(), so an id that isn't yours simply returns
 * nothing to read and refuses the send.
 */
export function useConversation(conversationId: string | null) {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [connection, setConnection] = useState<MessageConnection>("connecting");
  const [error, setError] = useState<string | null>(null);

  // The catch-up cursor. A ref so the realtime callback and the visibility
  // listener both see today's value without re-subscribing on every message.
  //
  // It carries the conversation it belongs to rather than being cleared when the
  // thread changes: a ref must not be written during render, and the alternative
  // — resetting it in an effect — leaves a window where the socket can fire a
  // catch-up for the new thread using the old thread's timestamp. Tagging it lets
  // catchUp simply ignore a cursor that isn't its own.
  const newestRef = useRef<{ conversationId: string; at: string } | null>(null);

  // Switching threads clears the previous one's tail before anything renders —
  // the recycled-component pattern from components/Avatar.tsx, rather than an
  // effect, so there is never a frame showing another conversation's messages.
  const [renderedId, setRenderedId] = useState(conversationId);
  if (renderedId !== conversationId) {
    setRenderedId(conversationId);
    setMessages([]);
    setIsLoading(true);
  }

  // Merge by id, keeping the thread sorted. The same message can arrive twice —
  // the sender's own RPC result, then the realtime-triggered catch-up — and
  // deduping here is what lets both paths stay simple.
  const merge = useCallback((incoming: ConversationMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const byId = new Map(current.map((message) => [message.id, message]));
      for (const message of incoming) byId.set(message.id, message);
      const next = Array.from(byId.values()).sort((a, b) =>
        a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at < b.created_at ? -1 : 1,
      );
      const newest = next[next.length - 1];
      const cursor = newestRef.current;
      const mine = cursor && cursor.conversationId === conversationId ? cursor.at : null;
      if (newest && conversationId && (!mine || newest.created_at > mine)) {
        newestRef.current = { conversationId, at: newest.created_at };
      }
      return next;
    });
  }, [conversationId]);

  const catchUp = useCallback(async () => {
    const cursor = newestRef.current;
    if (!conversationId || !cursor || cursor.conversationId !== conversationId) return;
    const since = cursor.at;
    const { data, error: catchUpError } = await supabase.rpc("conversation_new_messages", {
      p_conversation_id: conversationId,
      p_since: since,
    });
    if (catchUpError) {
      console.error("Failed to catch up on the conversation:", catchUpError.message);
      return;
    }
    merge((data ?? []) as ConversationMessage[]);
  }, [conversationId, merge]);

  // First load. Resets on a conversation change so switching threads can't show
  // the previous one's tail.
  useEffect(() => {
    if (isLoadingAuth || !user || !conversationId) return;

    let cancelled = false;

    supabase
      .rpc("conversation_list_messages", { p_conversation_id: conversationId })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError(submissionError(loadError).message);
        } else {
          const rows = (data ?? []) as ConversationMessage[];
          merge(rows);
          setHasMoreHistory(rows.length >= 50);
          if (rows.length > 0) markConversationRead(conversationId);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, isLoadingAuth, user, merge]);

  // The live socket, filtered to this thread server-side. The insert payload is
  // only a nudge — see the note at the top of this file.
  useEffect(() => {
    if (isLoadingAuth || !user || !conversationId) return;

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => void catchUp(),
      )
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
  }, [conversationId, isLoadingAuth, user, catchUp]);

  // The safety net that makes a dead socket survivable.
  useEffect(() => {
    if (!user || !conversationId) return;

    function handleWake() {
      if (document.visibilityState !== "visible") return;
      void catchUp();
      markConversationRead(conversationId!);
    }

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    return () => {
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
    };
  }, [user, conversationId, catchUp]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || isLoadingHistory || !conversationId) return;
    setIsLoadingHistory(true);
    const { data, error: historyError } = await supabase.rpc("conversation_list_messages", {
      p_conversation_id: conversationId,
      p_before: oldest.created_at,
    });
    if (historyError) {
      setError(submissionError(historyError).message);
    } else {
      const rows = (data ?? []) as ConversationMessage[];
      merge(rows);
      setHasMoreHistory(rows.length >= 50);
    }
    setIsLoadingHistory(false);
  }, [messages, isLoadingHistory, conversationId, merge]);

  const send = useCallback(
    async (body: string) => {
      if (!conversationId) return;
      setError(null);
      try {
        // Merged straight in rather than waited for: the sender shouldn't be the
        // last person to see their own message if the socket is down.
        merge([await sendMessage(conversationId, body)]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "That didn't send.");
        throw caught;
      }
    },
    [conversationId, merge],
  );

  return {
    messages,
    isLoading: isLoadingAuth || isLoading,
    hasMoreHistory,
    isLoadingHistory,
    connection,
    error,
    myUserId: user?.id ?? null,
    send,
    loadOlder,
  };
}

/** Unread messages across the reader's own threads — the header badge. Same
 *  nonce-refresh shape as useChatUnreadCount. */
export function useInboxUnreadCount() {
  const { user, isLoading } = useAuth();
  const [count, setCount] = useState(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // No setCount(0) for a signed-out reader: the return below already derives
    // that, and setting it here is the same answer one render later.
    if (isLoading || !user) return;

    let cancelled = false;

    supabase.rpc("inbox_unread_count").then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to count unread messages:", error.message);
        return;
      }
      setCount(data ?? 0);
    });

    return () => {
      cancelled = true;
    };
  }, [user, isLoading, nonce]);

  // A new message anywhere the reader can see it re-counts. Cheap: one integer.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`inbox-badge-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_messages" },
        () => setNonce((current) => current + 1),
      )
      .subscribe();

    function handleWake() {
      if (document.visibilityState === "visible") setNonce((current) => current + 1);
    }

    document.addEventListener("visibilitychange", handleWake);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleWake);
    };
  }, [user]);

  const refresh = useCallback(() => setNonce((current) => current + 1), []);

  return { count: user ? count : 0, refresh };
}

"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { useForumUnreadCount } from "@/lib/forum";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

// How much is waiting in the moderation tools, counted once for the whole app.
//
// Two things read these numbers: the dashboard, which badges each tile, and the
// Admin / Team rep button in the header, which badges the total so a moderator
// knows to go look without opening /admin to find out. A provider rather than a
// plain hook because both of those are on screen at the same time on /admin —
// one fetch, one answer, no chance of the button and the tiles disagreeing.
//
// A rep sees only what a rep can act on: submissions and reports come back
// team-scoped from RLS, the forum is open to them, and the site-wide admin
// queues aren't asked for at all.

export type AdminQueueCounts = {
  submissions: number;
  reports: number;
  /** Forum threads with activity this account hasn't read. */
  forumUnread: number;
  deadImages: number;
  scrapedGiveaways: number;
  tagRequests: number;
  /** Contact-form messages and rep applications nobody has handled yet. */
  messages: number;
};

type AdminQueueCountsValue = AdminQueueCounts & {
  /** Everything above, added up — what the header button badges. */
  total: number;
  refresh: () => void;
};

// Module-level so the "nothing to count" path can set it without handing React
// a fresh object (and a re-render) every time.
const NO_COUNTS: Omit<AdminQueueCounts, "forumUnread"> = {
  submissions: 0,
  reports: 0,
  deadImages: 0,
  scrapedGiveaways: 0,
  tagRequests: 0,
  messages: 0,
};

// A missing count is reported as zero rather than thrown: a badge is a nudge,
// and a moderator losing a queue to a network blip is better than every page on
// the site erroring because one head request failed.
async function countOf(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) {
    console.error(`Failed to count ${label}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

const AdminQueueCountsContext = createContext<AdminQueueCountsValue | null>(null);

export function AdminQueueCountsProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, isRep, isLoading } = useAdminAuth();
  const canAccess = isAdmin || isRep;
  const [counts, setCounts] = useState(NO_COUNTS);
  const [nonce, setNonce] = useState(0);
  // Unread is a join against this reader's own marks, so it comes from the
  // forum's own RPC rather than a head count like the rest.
  const { count: forumUnread, refresh: refreshForum } = useForumUnreadCount();

  const refresh = useCallback(() => {
    setNonce((current) => current + 1);
    refreshForum();
  }, [refreshForum]);

  useEffect(() => {
    if (isLoading || !canAccess) return;

    let cancelled = false;

    Promise.all([
      // Team-scoped by RLS: the same query gives a rep their team's number and
      // an admin the site-wide one.
      countOf(
        "pending submissions",
        supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      countOf(
        "pending listing reports",
        supabase
          .from("listing_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ),
      // The rest are site-wide admin tools. Skipped for a rep, who has no tile
      // to click through to.
      isAdmin
        ? countOf(
            "open dead images",
            supabase
              .from("dead_images")
              .select("id", { count: "exact", head: true })
              .eq("status", "open"),
          )
        : 0,
      isAdmin
        ? countOf(
            "pending scraped giveaways",
            supabase
              .from("scraped_giveaways")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
          )
        : 0,
      isAdmin
        ? countOf(
            "pending tag requests",
            supabase
              .from("tag_requests")
              .select("id", { count: "exact", head: true })
              .eq("status", "pending"),
          )
        : 0,
      isAdmin
        ? countOf(
            "unhandled inbound messages",
            supabase
              .from("inbound_messages")
              .select("id", { count: "exact", head: true })
              .eq("status", "new"),
          )
        : 0,
    ]).then(([submissions, reports, deadImages, scrapedGiveaways, tagRequests, messages]) => {
      if (cancelled) return;
      setCounts({ submissions, reports, deadImages, scrapedGiveaways, tagRequests, messages });
    });

    return () => {
      cancelled = true;
    };
  }, [canAccess, isAdmin, isLoading, nonce]);

  // Clearing a queue should clear the badge. Rather than have every admin page
  // remember to say so, re-count on the way out of /admin — the one navigation
  // after which these numbers are reliably wrong.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (lastPathname.startsWith("/admin")) {
      refresh();
    }
  }

  // A moderator leaves the site open in a tab for hours; counts fetched on load
  // go stale behind their back. Re-check when they come back to the tab, at most
  // once a minute — this is a nudge, not a live feed.
  useEffect(() => {
    if (!canAccess) return;

    let lastCheckedAt = Date.now();

    function handleVisibility() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastCheckedAt < 60_000) return;
      lastCheckedAt = now;
      refresh();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [canAccess, refresh]);

  const value = useMemo<AdminQueueCountsValue>(() => {
    // Gated here rather than cleared in the effect: whoever just signed out (or
    // lost their grant) shouldn't leave their numbers behind on the way.
    const all = canAccess ? { ...counts, forumUnread } : { ...NO_COUNTS, forumUnread: 0 };

    return {
      ...all,
      total: Object.values(all).reduce((sum, count) => sum + count, 0),
      refresh,
    };
  }, [canAccess, counts, forumUnread, refresh]);

  return (
    <AdminQueueCountsContext.Provider value={value}>{children}</AdminQueueCountsContext.Provider>
  );
}

export function useAdminQueueCounts(): AdminQueueCountsValue {
  const context = useContext(AdminQueueCountsContext);

  if (!context) {
    throw new Error("useAdminQueueCounts must be used inside AdminQueueCountsProvider.");
  }

  return context;
}

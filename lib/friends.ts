"use client";

import type { PostgrestError } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { buildBobbleheadResolver } from "@/lib/bobbleheadIdentity";
import type { PublicGalleryItem } from "@/lib/publicShelf";
import { submissionError } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";

// Friends — see supabase/friends.sql for the model. Everything goes through
// RPCs: profiles is owner-read-only, so even rendering a friend's name
// requires the server-side join list_friendships does.

export type Friendship = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  /** The other person's shelf slug. Minted at signup, so null only on the odd
   *  account whose mint never landed. */
  slug: string | null;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted";
  createdAt: string;
};

/** What the caller may do on one shelf page. */
export type FriendShelfStatus =
  | "loading"
  | "signed-out"
  | "none"
  | "pending_out"
  | "pending_in"
  | "friends"
  | "self";

function toFriendship(row: {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  slug: string | null;
  direction: string;
  status: string;
  created_at: string;
}): Friendship {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    slug: row.slug,
    direction: row.direction === "incoming" ? "incoming" : "outgoing",
    status: row.status === "accepted" ? "accepted" : "pending",
    createdAt: row.created_at,
  };
}

/** Send a request by shelf slug (or a pasted /shelf/ link — callers extract
 *  the slug). Resolves to what happened; throws a friendly Error otherwise. */
export async function sendFriendRequest(
  slug: string,
): Promise<"pending" | "accepted" | "already_pending" | "already_friends"> {
  const { data, error } = await supabase.rpc("send_friend_request", { p_slug: slug });
  if (error) throw submissionError(error);
  return data as "pending" | "accepted" | "already_pending" | "already_friends";
}

/**
 * The signed-in member's whole friendship world: friends, incoming asks,
 * outgoing pending. One RPC, split three ways. Actions reload the list rather
 * than patching it — the volumes are tiny and a reload can't drift.
 */
export function useFriendships() {
  const { user } = useAuth();
  const { showError } = useToast();
  const [rows, setRows] = useState<Friendship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    // No sync setState for the signed-out case: the return below already
    // reports isLoading false whenever there's no user.
    if (!user) return;

    let cancelled = false;

    supabase.rpc("list_friendships").then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load friendships:", error.message);
      } else {
        setRows((data ?? []).map(toFriendship));
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const act = useCallback(
    async (action: () => PromiseLike<{ error: PostgrestError | null }>) => {
      const { error } = await action();
      if (error) {
        showError(submissionError(error).message);
        return;
      }
      refresh();
    },
    [refresh, showError],
  );

  const respond = useCallback(
    (requesterId: string, accept: boolean) =>
      act(() =>
        supabase.rpc("respond_friend_request", { p_requester: requesterId, p_accept: accept }),
      ),
    [act],
  );

  const cancel = useCallback(
    (addresseeId: string) =>
      act(() => supabase.rpc("cancel_friend_request", { p_addressee: addresseeId })),
    [act],
  );

  const remove = useCallback(
    (userId: string) => act(() => supabase.rpc("remove_friend", { p_user_id: userId })),
    [act],
  );

  const friends = rows.filter((row) => row.status === "accepted");
  const incoming = rows.filter((row) => row.status === "pending" && row.direction === "incoming");
  const outgoing = rows.filter((row) => row.status === "pending" && row.direction === "outgoing");

  return {
    friends,
    incoming,
    outgoing,
    isLoading: user ? isLoading : false,
    isLoggedIn: Boolean(user),
    respond,
    cancel,
    remove,
    refresh,
  };
}

/**
 * The friendship machinery for one /shelf/<slug> page: where the viewer
 * stands, the actions the button offers, and — once friends — the full
 * gallery (owned + favorites + wanted), resolved to titles and photos with
 * the same resolver the public gallery uses, just running in the browser
 * against the viewer's own session.
 */
export function useFriendShelf(slug: string) {
  const { user } = useAuth();
  const { showError } = useToast();
  const [fetchedStatus, setFetchedStatus] = useState<FriendShelfStatus>("loading");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  // Whether this shelf's owner shows friends more than the public — the reason
  // a friend can be looking at an empty gallery, so the panel can say which
  // switch is off instead of guessing (supabase/friends_visibility.sql).
  const [ownerSharesWithFriends, setOwnerSharesWithFriends] = useState(true);
  // Keyed by slug so a stale gallery can't flash under a different shelf, and
  // so loading is *derived* (key mismatch) rather than its own flag — the
  // effects below then never need a synchronous setState.
  const [gallery, setGallery] = useState<{ key: string; items: PublicGalleryItem[] } | null>(null);
  const [nonce, setNonce] = useState(0);

  // Signed-out is derived, not stored; and a sign-in/out mid-visit resets the
  // fetched answer during render (the recycled-component pattern) so the old
  // account's status never shows for the new one.
  const [prevUser, setPrevUser] = useState(user);
  if (prevUser !== user) {
    setPrevUser(user);
    setFetchedStatus("loading");
    setGallery(null);
  }
  const status: FriendShelfStatus = user ? fetchedStatus : "signed-out";

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    supabase.rpc("friend_shelf_status", { p_slug: slug }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("Failed to load friend status:", error.message);
        setFetchedStatus("none");
        return;
      }
      const row = (data ?? [])[0];
      setFetchedStatus((row?.status as FriendShelfStatus) ?? "none");
      setOwnerId(row?.owner_id ?? null);
      setOwnerSharesWithFriends(row?.owner_shares_with_friends ?? true);
    });

    return () => {
      cancelled = true;
    };
  }, [slug, user, nonce]);

  useEffect(() => {
    if (status !== "friends") return;

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.rpc("get_friend_gallery", { p_slug: slug });
      if (cancelled) return;
      if (error) {
        console.error("Failed to load friend gallery:", error.message);
        setGallery({ key: slug, items: [] });
        return;
      }
      const rows = data ?? [];
      const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));
      const resolve = await buildBobbleheadResolver(supabase, teamSlugs);
      if (cancelled) return;
      setGallery({
        key: slug,
        items: rows
          .map((row) => ({
            kind:
              row.kind === "favorite"
                ? ("favorite" as const)
                : row.kind === "wanted"
                  ? ("wanted" as const)
                  : ("owned" as const),
            ...resolve(row.team_slug, row.bobblehead_id),
          }))
          .filter((item) => !item.deleted),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [status, slug]);

  const items = status === "friends" && gallery?.key === slug ? gallery.items : [];
  const isGalleryLoading = status === "friends" && gallery?.key !== slug;

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const send = useCallback(async () => {
    try {
      await sendFriendRequest(slug);
      refresh();
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "Couldn't send that request.");
    }
  }, [slug, refresh, showError]);

  const accept = useCallback(async () => {
    if (!ownerId) return;
    const { error } = await supabase.rpc("respond_friend_request", {
      p_requester: ownerId,
      p_accept: true,
    });
    if (error) {
      showError(submissionError(error).message);
      return;
    }
    refresh();
  }, [ownerId, refresh, showError]);

  const cancel = useCallback(async () => {
    if (!ownerId) return;
    const { error } = await supabase.rpc("cancel_friend_request", { p_addressee: ownerId });
    if (error) {
      showError(submissionError(error).message);
      return;
    }
    refresh();
  }, [ownerId, refresh, showError]);

  return { status, items, isGalleryLoading, ownerSharesWithFriends, send, accept, cancel };
}

// ---------------------------------------------------------------------------
// Finding people
// ---------------------------------------------------------------------------
// Discovery, added on top of the slug-link flow rather than replacing it: a
// pasted link still works, and is still the only thing that works for someone
// who knows the link but not the name. See supabase/member_search.sql for what
// the search will and won't answer — notably not anything about an email.

/** One hit. `slug` is non-null by construction: the RPC skips unaddressable
 *  profiles, since a request has no shelf to name. */
export type MemberResult = {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  slug: string;
  status: "none" | "pending_out" | "pending_in" | "friends";
};

/** Mirrors the floor in search_members: under this the RPC returns nothing, so
 *  there's no point spending a round trip to hear it. */
export const MIN_MEMBER_QUERY = 2;

/** Pulls the slug out of a pasted shelf link: a full URL, or one with a
 *  trailing slash or query noise. Anything that isn't a shelf link comes back
 *  unchanged, so a name that happens to contain a slash is searched as typed. */
export function slugFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes("/shelf/")) return trimmed;
  const afterShelf = trimmed.split("/shelf/")[1] ?? "";
  return afterShelf.split(/[/?#]/)[0]?.trim() ?? "";
}

/**
 * The query as the RPC would see it, or "" for one it would refuse.
 *
 * A pasted shelf link is reduced to its slug and then searched like any other
 * term — search_members matches slug as well as display name, so the link flow
 * this feature grew out of keeps working, and now shows you whose shelf it is
 * before you ask instead of firing a request blind at a slug.
 *
 * Exported for the input's own copy, so the UI's idea of "searchable" and the
 * database's can't drift apart.
 */
export function memberQuery(raw: string): string {
  const slug = slugFromInput(raw);
  return slug.length >= MIN_MEMBER_QUERY ? slug : "";
}

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Type-to-search over members, debounced.
 *
 * Results are stored keyed by the query that produced them, the same shape
 * useFriendShelf uses for its gallery: a slow response for "al" can't land on
 * top of a fresh one for "alex", and isSearching is then derived from the key
 * not matching rather than being a second flag to keep in sync.
 *
 * onSent is how the friend lists beside this search hear about a request: one
 * sent here belongs in "Waiting on Them" immediately, or the same person is
 * visibly pending in one place and absent in the other.
 */
export function useMemberSearch(onSent?: () => void) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [found, setFound] = useState<{ key: string; rows: MemberResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = memberQuery(draft);

  useEffect(() => {
    if (!user || !query) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      supabase.rpc("search_members", { p_query: query }).then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          console.error("Member search failed:", rpcError.message);
          setError("Couldn't run that search. Try again in a moment.");
          setFound({ key: query, rows: [] });
          return;
        }
        setError(null);
        setFound({
          key: query,
          rows: (data ?? []).map((row) => ({
            userId: row.user_id,
            displayName: row.display_name,
            avatarPath: row.avatar_path,
            slug: row.slug,
            status: (row.status as MemberResult["status"]) ?? "none",
          })),
        });
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, user]);

  /** Ask, then move just that row to its new standing. The whole result set
   *  doesn't need refetching — nothing else about it changed — and re-running
   *  the search would reshuffle rows under someone reading mid-list. Returns
   *  null on success, or the message for that row. */
  const ask = useCallback(
    async (member: MemberResult) => {
      try {
        const outcome = await sendFriendRequest(member.slug);
        const settled = outcome === "accepted" || outcome === "already_friends";
        setFound((current) =>
          current
            ? {
                ...current,
                rows: current.rows.map((row) =>
                  row.userId === member.userId
                    ? { ...row, status: settled ? "friends" : "pending_out" }
                    : row,
                ),
              }
            : current,
        );
        onSent?.();
        return null;
      } catch (caught) {
        return caught instanceof Error ? caught.message : "Couldn't send that request.";
      }
    },
    [onSent],
  );

  return {
    draft,
    setDraft,
    query,
    results: found?.key === query ? found.rows : [],
    // A refused query isn't a pending search: it will never resolve into rows.
    isSearching: Boolean(query) && found?.key !== query,
    hasSearched: found?.key === query,
    error,
    ask,
  };
}

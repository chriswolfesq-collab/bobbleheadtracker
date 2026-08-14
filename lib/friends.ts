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

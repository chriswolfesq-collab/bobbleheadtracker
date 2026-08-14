"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { computeCollectingStreak } from "@/lib/awards";
import {
  type BobbleheadIdentity,
  bobbleheadHref,
  buildBobbleheadResolver,
  listingKey,
} from "@/lib/bobbleheadIdentity";
import { useBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { fetchAllPages, supabase } from "@/lib/supabase";
import { TEAMS } from "@/lib/teams";

export type TeamCount = { teamSlug: string; count: number };

// The collection/favorites/submissions hooks default to the signed-in site
// user (via useAuth + the regular supabase client), but admin mode passes an
// explicit target user id and the admin client so the "view profile" page can
// render any user's profile read-only. Admin reads are allowed by the
// "…: admin select" RLS policies added in supabase/schema.sql.
export type ProfileSource = { userId?: string; client?: SupabaseClient };

/**
 * The two award facts that can't be derived from a collection: where the member
 * came in, and which teams they rep.
 *
 * Both are cheap single-row reads, and both are stable for the life of an
 * account, so they load alongside the collection rather than gating it — the
 * awards shelf renders the collection ladders immediately and fills these in
 * when they land. `isLoading` exists so the celebration can tell "not a rep"
 * apart from "haven't asked yet"; congratulating someone on a rep award that
 * then vanishes would be worse than showing it a moment late.
 *
 * Reads profiles directly under the "profiles: owner select" policy (and the
 * admin one, in the read-only view). member_number is null for accounts that
 * predate supabase/awards.sql and were never backfilled.
 */
export function useMyAwardFacts(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [memberNumber, setMemberNumber] = useState<number | null>(null);
  const [repTeams, setRepTeams] = useState<string[]>([]);
  // Not an award fact, but it lives on the same profiles row this hook already
  // reads — carrying it here costs nothing where its own hook would be a second
  // round trip on every profile load just to decide whether to show a banner.
  const [introAcknowledged, setIntroAcknowledged] = useState<boolean | null>(null);
  const [approvedSubmissions, setApprovedSubmissions] = useState(0);
  const [qualifyingReferrals, setQualifyingReferrals] = useState(0);
  const [streakMonths, setStreakMonths] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Signed out: nothing to fetch, and the return below already reports
    // isLoading false for that case rather than leaving it stuck true.
    if (!userId) return;

    let cancelled = false;

    Promise.all([
      client
        .from("profiles")
        .select("member_number, awards_intro_ack_at")
        .eq("id", userId)
        .maybeSingle(),
      // Scoped to the signed-in session by auth.jwt(), so it's only meaningful
      // for the owner's own profile. In the admin read-only view it would
      // answer for the admin, not the member being viewed — hence the guard.
      source?.userId ? Promise.resolve({ data: null, error: null }) : client.rpc("my_rep_teams"),
      // Same auth.uid() scoping as my_rep_teams, so it's owner-only too. In the
      // admin read-only view it would answer for the admin rather than the
      // member being looked at, which is why it's skipped there.
      source?.userId
        ? Promise.resolve({ data: null, error: null })
        : client.rpc("my_award_activity"),
    ]).then(([profile, reps, activity]) => {
      if (cancelled) return;

      if (profile.error) {
        console.error("Failed to load your member number:", profile.error.message);
        // Leave introAcknowledged null on failure. The banner treats null as
        // "don't know yet" and stays hidden, so a flaky read can't produce an
        // announcement for someone who already dismissed it.
      } else {
        setMemberNumber(profile.data?.member_number ?? null);
        setIntroAcknowledged(profile.data?.awards_intro_ack_at !== null);
      }

      if (reps.error) {
        console.error("Failed to load your rep teams:", reps.error.message);
      } else {
        setRepTeams((reps.data as string[] | null) ?? []);
      }

      if (activity.error) {
        console.error("Failed to load your award activity:", activity.error.message);
      } else {
        // Returns at most one row, and none at all when unauthenticated.
        const row = (
          activity.data as
            | { approved_submissions: number; qualifying_referrals: number; months: string[] }[]
            | null
        )?.[0];
        setApprovedSubmissions(row?.approved_submissions ?? 0);
        setQualifyingReferrals(row?.qualifying_referrals ?? 0);
        // Same function the public shelf runs over the same month list, so a
        // collector's own streak and the one on their shared link agree.
        setStreakMonths(computeCollectingStreak(row?.months ?? [], new Date()));
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, client, source?.userId]);

  // Optimistic: the banner hides the moment it's clicked rather than waiting on
  // the round trip, and a failed write only means it reappears next visit.
  const acknowledgeIntro = useCallback(() => {
    setIntroAcknowledged(true);
    supabase.rpc("ack_awards_intro").then(({ error }) => {
      if (error) console.error("Failed to record the awards intro:", error.message);
    });
  }, []);

  return {
    memberNumber,
    repTeams,
    approvedSubmissions,
    qualifyingReferrals,
    streakMonths,
    introAcknowledged,
    acknowledgeIntro,
    isLoading: userId ? isLoading : false,
  };
}

// The site total per team is the curated giveaway list (static) plus any
// community-submitted bobbleheads that have been approved for that team.
export function useSiteBobbleheadCounts() {
  const [communityCountByTeamSlug, setCommunityCountByTeamSlug] = useState<Record<string, number>>({});
  const [deletedCountByTeamSlug, setDeletedCountByTeamSlug] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Curated totals must subtract admin-deleted listings or the profile's
    // denominator disagrees with what the team pages actually show.
    Promise.all([
      supabase.from("community_bobbleheads").select("team_slug"),
      supabase.from("bobblehead_overrides").select("team_slug").eq("deleted", true),
    ]).then(([community, deleted]) => {
      if (cancelled) return;

      if (community.error) {
        console.error("Failed to load community bobblehead counts:", community.error.message);
        setCommunityCountByTeamSlug({});
      } else {
        const counts: Record<string, number> = {};
        for (const row of community.data ?? []) {
          counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
        }
        setCommunityCountByTeamSlug(counts);
      }

      if (deleted.error) {
        console.error("Failed to load deleted listing counts:", deleted.error.message);
        setDeletedCountByTeamSlug({});
      } else {
        const counts: Record<string, number> = {};
        for (const row of deleted.data ?? []) {
          counts[row.team_slug] = (counts[row.team_slug] ?? 0) + 1;
        }
        setDeletedCountByTeamSlug(counts);
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalByTeamSlug: Record<string, number> = {};
  for (const team of TEAMS) {
    totalByTeamSlug[team.slug] = Math.max(
      0,
      getGiveawaysByTeamSlug(team.slug).length -
        (deletedCountByTeamSlug[team.slug] ?? 0) +
        (communityCountByTeamSlug[team.slug] ?? 0),
    );
  }
  const siteTotal = Object.values(totalByTeamSlug).reduce((sum, count) => sum + count, 0);

  return { totalByTeamSlug, siteTotal, isLoading };
}

export function useCollectionSummary(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  // The rows rather than the tally, because which listing each one points at
  // decides whether it counts — see below.
  const [ownedRows, setOwnedRows] = useState<{ teamSlug: string; bobbleheadId: string }[] | null>(
    null,
  );
  const { isDeleted, isLoaded: overridesLoaded } = useBobbleheadOverrides();

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("user_collections")
      .select("team_slug, bobblehead_id, owned")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your collection summary:", error.message);
          setOwnedRows([]);
        } else {
          setOwnedRows(
            (data ?? [])
              .filter((row) => row.owned)
              .map((row) => ({ teamSlug: row.team_slug, bobbleheadId: row.bobblehead_id })),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  // Deleting a listing leaves everyone's collection row behind, and this used
  // to count them: the total said you owned bobbleheads that no longer exist,
  // over a denominator that already subtracts them — so a team could read 13
  // of 12, and the owned list underneath disagreed with the number above it.
  const countByTeamSlug = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of ownedRows ?? []) {
      if (isDeleted(row.teamSlug, row.bobbleheadId)) continue;
      counts[row.teamSlug] = (counts[row.teamSlug] ?? 0) + 1;
    }
    return counts;
  }, [ownedRows, isDeleted]);

  const resolvedCounts = userId ? countByTeamSlug : {};
  const totalOwned = Object.values(resolvedCounts).reduce((sum, count) => sum + count, 0);
  // Still loading until the overrides are in too: a count that lands high and
  // then drops reads as though something was lost.
  const isLoading = ownedRows === null || !overridesLoaded;

  return { countByTeamSlug: resolvedCounts, totalOwned, isLoading: userId ? isLoading : false };
}

// A signed-out reader gets the same empty set every render, so the memos
// downstream of it don't recompute on every pass.
const NO_OWNED_KEYS: ReadonlySet<string> = new Set();

/**
 * Which listings the signed-in user owns, across every team, keyed by
 * `listingKey`. useUserCollection answers the same question one team at a time,
 * which is all a team page ever needs; a tag cuts across teams, so tracking
 * progress against one means holding the whole collection at once.
 *
 * The setter writes the same user_collections row the team pages do, so
 * checking something off from a tag page and from its team page are the same
 * act — optimistic, reverted and toasted if the save fails.
 */
export function useOwnedKeys(): {
  ownedKeys: ReadonlySet<string>;
  isLoading: boolean;
  isLoggedIn: boolean;
  setOwned: (teamSlug: string, bobbleheadId: string, owned: boolean) => Promise<void>;
} {
  const { user } = useAuth();
  const { showError } = useToast();
  const userId = user?.id ?? null;
  const [ownedKeys, setOwnedKeys] = useState<ReadonlySet<string>>(NO_OWNED_KEYS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    // Paged, because a checklist built from a collection trimmed at PostgREST's
    // row cap would report a long-time collector as owning less than they do.
    fetchAllPages((from, to) =>
      supabase
        .from("user_collections")
        .select("bobblehead_id, team_slug")
        .eq("user_id", userId)
        .eq("owned", true)
        .order("bobblehead_id")
        .range(from, to),
    ).then((rows) => {
      if (cancelled) return;

      if (!rows) {
        console.error("Failed to load your collection.");
        setOwnedKeys(NO_OWNED_KEYS);
      } else {
        setOwnedKeys(new Set(rows.map((row) => listingKey(row.team_slug, row.bobblehead_id))));
      }

      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setOwned = useCallback(
    async (teamSlug: string, bobbleheadId: string, owned: boolean) => {
      if (!userId) return;

      const key = listingKey(teamSlug, bobbleheadId);
      // Optimistic; reverted below if the save fails.
      setOwnedKeys((current) => {
        const next = new Set(current);
        if (owned) next.add(key);
        else next.delete(key);
        return next;
      });

      const { error } = await supabase.from("user_collections").upsert(
        {
          user_id: userId,
          bobblehead_id: bobbleheadId,
          team_slug: teamSlug,
          owned,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,team_slug,bobblehead_id" },
      );

      if (error) {
        console.error("Failed to save owned:", error.message);
        setOwnedKeys((current) => {
          const next = new Set(current);
          if (owned) next.delete(key);
          else next.add(key);
          return next;
        });
        showError("Couldn't save that. Please try again.");
      }
    },
    [userId, showError],
  );

  return {
    ownedKeys: userId ? ownedKeys : NO_OWNED_KEYS,
    isLoading: userId ? isLoading : false,
    isLoggedIn: Boolean(userId),
    setOwned,
  };
}

export type MyShelf = {
  /** null until the user has enabled sharing at least once. */
  slug: string | null;
  isPublic: boolean;
  /** The name shown at the top of the public shelf — profiles.display_name,
   *  the same source get_public_shelf uses, so a preview matches the live page
   *  even if an admin has edited the name away from the auth metadata. */
  displayName: string;
};

// Returned by useMyShelf. Named so the profile page can call the hook once and
// hand the result to both the privacy toggle and the share buttons, rather than
// each calling the hook and refetching the same row.
export type ShelfSharing = {
  shelf: MyShelf;
  isLoading: boolean;
  isSaving: boolean;
  setPublic: (isPublic: boolean) => Promise<{ error: string | null }>;
};

// The signed-in user's public-shelf settings. Reads profiles directly (allowed
// by the "profiles: owner select" policy) but writes through the
// enable/disable RPCs, because profiles has no update policy — the client must
// not be able to pick its own slug and squat someone else's shelf URL.
//
// No ProfileSource here, unlike the hooks above: this is a settings surface for
// your own account, and there's deliberately no admin path to publish someone
// else's shelf on their behalf.
export function useMyShelf(): ShelfSharing {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [shelf, setShelf] = useState<MyShelf>({ slug: null, isPublic: false, displayName: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("slug, is_public, display_name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your shelf settings:", error.message);
        } else {
          setShelf({
            slug: data?.slug ?? null,
            isPublic: data?.is_public ?? false,
            displayName: data?.display_name ?? "",
          });
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setPublic(isPublic: boolean): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    setIsSaving(true);
    const { data, error } = isPublic
      ? await supabase.rpc("enable_public_shelf")
      : await supabase.rpc("disable_public_shelf");
    setIsSaving(false);

    if (error) {
      console.error("Failed to update your shelf settings:", error.message);
      return { error: "Couldn't update your shelf. Try again." };
    }

    // enable_public_shelf returns the slug, minting it on the first call;
    // disable returns nothing and leaves the slug alone, so the URL survives a
    // round trip through private and back.
    setShelf((current) => ({
      slug: isPublic ? ((data as string | null) ?? current.slug) : current.slug,
      isPublic,
      displayName: current.displayName,
    }));
    return { error: null };
  }

  return {
    shelf: userId ? shelf : { slug: null, isPublic: false, displayName: "" },
    isLoading: userId ? isLoading : false,
    isSaving,
    setPublic,
  };
}

/**
 * The email switches, keyed the same way as set_email_preference's p_kind (see
 * supabase/email_preferences.sql). "all" is the master switch; the rest are
 * per-type.
 */
export type EmailPreferenceKind =
  | "all"
  | "wanted_alerts"
  | "submission_updates"
  | "rep_digest"
  | "weekly_digest"
  | "forum_digest";

export type EmailPreferences = {
  values: Record<EmailPreferenceKind, boolean>;
  isLoading: boolean;
  /** Which switch is mid-save, so only that row disables. */
  savingKind: EmailPreferenceKind | null;
  /** The rep digest only goes to admins, so its switch is only shown to one. */
  isAdmin: boolean;
  /** The forum digest goes to admins *and* team reps — everyone who can read
   *  the board. A wider audience than isAdmin, hence its own flag. */
  isModerator: boolean;
  setPreference: (
    kind: EmailPreferenceKind,
    enabled: boolean,
  ) => Promise<{ error: string | null }>;
};

// Optimistic defaults match the column defaults (all on) so the switches don't
// flicker off before the row loads.
const DEFAULT_PREFERENCES: Record<EmailPreferenceKind, boolean> = {
  all: true,
  wanted_alerts: true,
  submission_updates: true,
  rep_digest: true,
  weekly_digest: true,
  forum_digest: true,
};

// The signed-in user's email preferences: the master switch plus one per kind of
// automated mail the site sends (see supabase/email_preferences.sql). Reads
// profiles directly (allowed by "profiles: owner select") but writes through
// set_email_preference, because profiles has no client update policy — same
// split as useMyShelf above.
export function useEmailPreferences(): EmailPreferences {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [values, setValues] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKind, setSavingKind] = useState<EmailPreferenceKind | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    Promise.all([
      supabase
        .from("profiles")
        // Spelled out rather than derived from the kind list: a computed select
        // string erases the row type supabase-js infers from it.
        .select(
          "email_enabled, email_wishlist_alerts, email_submission_updates, email_rep_digest, email_weekly_digest, email_forum_digest",
        )
        .eq("id", userId)
        .maybeSingle(),
      // These two only decide which digest switches to render; both digests are
      // gated server-side, so a wrong answer here can't leak anything.
      supabase.rpc("is_admin"),
      supabase.rpc("is_moderator"),
    ]).then(([{ data, error }, { data: adminData }, { data: moderatorData }]) => {
      if (cancelled) return;

      if (error) {
        console.error("Failed to load your email settings:", error.message);
      } else if (data) {
        const row = data as Record<string, boolean | null>;
        setValues({
          all: row.email_enabled ?? true,
          wanted_alerts: row.email_wishlist_alerts ?? true,
          submission_updates: row.email_submission_updates ?? true,
          rep_digest: row.email_rep_digest ?? true,
          weekly_digest: row.email_weekly_digest ?? true,
          forum_digest: row.email_forum_digest ?? true,
        });
      }

      setIsAdmin(adminData === true);
      setIsModerator(moderatorData === true);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setPreference(
    kind: EmailPreferenceKind,
    enabled: boolean,
  ): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    // Optimistic; reverted below if the save fails.
    const previous = values;
    setValues({ ...values, [kind]: enabled });
    setSavingKind(kind);
    const { error } = await supabase.rpc("set_email_preference", {
      p_kind: kind,
      p_enabled: enabled,
    });
    setSavingKind(null);

    if (error) {
      console.error("Failed to update your email settings:", error.message);
      setValues(previous);
      return { error: "Couldn't update your email settings. Try again." };
    }

    return { error: null };
  }

  return {
    values: userId ? values : DEFAULT_PREFERENCES,
    isLoading: userId ? isLoading : false,
    savingKind,
    isAdmin,
    isModerator,
    setPreference,
  };
}

export type GallerySharing = {
  enabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  setEnabled: (enabled: boolean) => Promise<{ error: string | null }>;
};

// The signed-in user's opt-in to show their actual owned bobbleheads and
// favorites on their public shelf, rather than just the counts (see
// supabase/gallery.sql). Reads profiles directly (allowed by "profiles: owner
// select") but writes through set_gallery_public, because profiles has no
// client update policy — same split as useMyShelf / useEmailAlerts above. This
// only has any public effect while the shelf itself is public; the gallery RPC
// gates on both flags.
export function useGallerySharing(): GallerySharing {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // Optimistic default matches the column default (off).
  const [enabled, setEnabledState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("gallery_public")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Failed to load your gallery settings:", error.message);
        } else {
          setEnabledState(data?.gallery_public ?? false);
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function setEnabled(next: boolean): Promise<{ error: string | null }> {
    if (!userId) return { error: "Not signed in." };

    // Optimistic; reverted below if the save fails.
    const previous = enabled;
    setEnabledState(next);
    setIsSaving(true);
    const { error } = await supabase.rpc("set_gallery_public", { p_enabled: next });
    setIsSaving(false);

    if (error) {
      console.error("Failed to update your gallery settings:", error.message);
      setEnabledState(previous);
      return { error: "Couldn't update your gallery. Try again." };
    }

    return { error: null };
  }

  return {
    enabled: userId ? enabled : false,
    isLoading: userId ? isLoading : false,
    isSaving,
    setEnabled,
  };
}

export type MySubmission = {
  id: string;
  kind: "photo_for_existing" | "new_bobblehead";
  teamSlug: string;
  title: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  imageUrl: string | null;
  href: string | null;
};

// Pending/rejected photos still live in the private bobblehead-pending bucket
// (readable by their owner via RLS), while approved photos were copied to the
// public bobblehead-approved bucket under `${submissionId}-${filename}` (see
// moveToApproved in app/admin/review/page.tsx) — so the URL has to be derived
// differently depending on status.
function approvedSubmissionImageUrl(
  client: SupabaseClient,
  submissionId: string,
  storagePath: string | null,
): string | null {
  if (!storagePath) return null;
  const filename = storagePath.split("/").pop() ?? "photo";
  const { data } = client.storage
    .from("bobblehead-approved")
    .getPublicUrl(`${submissionId}-${filename}`);
  return data.publicUrl ?? null;
}

// One signed-URL request for all pending/rejected photos rather than one per
// submission. Paths that fail to sign are simply absent from the map.
async function signPendingImageUrls(
  client: SupabaseClient,
  storagePaths: (string | null)[],
): Promise<Map<string, string>> {
  const paths = storagePaths.filter((path): path is string => Boolean(path));
  if (paths.length === 0) return new Map();

  const { data } = await client.storage
    .from("bobblehead-pending")
    .createSignedUrls(paths, 60 * 10);

  return new Map(
    (data ?? []).flatMap((item) =>
      item.path && item.signedUrl ? [[item.path, item.signedUrl] as [string, string]] : [],
    ),
  );
}

// The DB columns kind/status are `text` (generated as `string`), but a CHECK
// constrains them to these unions, so the row is narrowed to MySubmission's
// literal types once at the query boundary.
type SubmissionRow = {
  id: string;
  kind: MySubmission["kind"];
  status: MySubmission["status"];
  team_slug: string;
  title: string | null;
  created_at: string;
  storage_path: string | null;
  target_bobblehead_id: string | null;
};

// A new_bobblehead submission becomes a community_bobbleheads row whose generated
// id ends in the submission's first 8 chars (see approve_submission() in
// supabase/schema.sql). Rather than one lookup per approved submission (an N+1),
// fetch every community row for the relevant teams once and match in memory,
// returning a submissionId -> href map. Only approved new_bobblehead rows need it.
async function fetchNewBobbleheadHrefs(
  client: SupabaseClient,
  rows: SubmissionRow[],
): Promise<Map<string, string>> {
  const approvedNew = rows.filter((r) => r.status === "approved" && r.kind === "new_bobblehead");
  if (approvedNew.length === 0) return new Map();

  const teamSlugs = Array.from(new Set(approvedNew.map((r) => r.team_slug)));
  const { data } = await client
    .from("community_bobbleheads")
    .select("id, team_slug")
    .in("team_slug", teamSlugs);

  const communityRows = data ?? [];
  const hrefBySubmissionId = new Map<string, string>();
  for (const submission of approvedNew) {
    const suffix = `-${submission.id.slice(0, 8)}`;
    const match = communityRows.find(
      (c) => c.team_slug === submission.team_slug && c.id.endsWith(suffix),
    );
    if (match) {
      hrefBySubmissionId.set(submission.id, bobbleheadHref(submission.team_slug, match.id, false));
    }
  }

  return hrefBySubmissionId;
}

// A submission only becomes a real listing once it's approved. photo_for_existing
// points at either a curated bobblehead (static list) or a community one, resolved
// synchronously; new_bobblehead uses the batched lookup above.
function submissionHref(row: SubmissionRow, newBobbleheadHrefs: Map<string, string>): string | null {
  if (row.status !== "approved") return null;

  if (row.kind === "photo_for_existing") {
    if (!row.target_bobblehead_id) return null;
    const isCurated = getGiveawaysByTeamSlug(row.team_slug).some((g) => g.id === row.target_bobblehead_id);
    return bobbleheadHref(row.team_slug, row.target_bobblehead_id, isCurated);
  }

  return newBobbleheadHrefs.get(row.id) ?? null;
}

export function useMySubmissions(source?: ProfileSource) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [submissions, setSubmissions] = useState<MySubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    client
      .from("submissions")
      .select("id, kind, team_slug, title, status, created_at, storage_path, target_bobblehead_id")
      .eq("submitted_by", userId)
      .order("created_at", { ascending: false })
      .then(async ({ data, error: queryError }) => {
        if (cancelled) return;

        if (queryError) {
          console.error("Failed to load your submissions:", queryError.message);
          setError("Couldn't load your submissions. Please refresh.");
          setSubmissions([]);
          setIsLoading(false);
          return;
        }

        const rows = (data ?? []) as unknown as SubmissionRow[];
        // Two batched round-trips regardless of row count: sign the pending
        // images, and resolve the approved new_bobblehead hrefs in one query.
        const [signedUrlByPath, newBobbleheadHrefs] = await Promise.all([
          signPendingImageUrls(
            client,
            rows.filter((row) => row.status !== "approved").map((row) => row.storage_path),
          ),
          fetchNewBobbleheadHrefs(client, rows),
        ]);

        if (cancelled) return;

        const withDetails = rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          teamSlug: row.team_slug,
          title: row.title,
          status: row.status,
          createdAt: row.created_at,
          imageUrl:
            row.status === "approved"
              ? approvedSubmissionImageUrl(client, row.id, row.storage_path)
              : ((row.storage_path && signedUrlByPath.get(row.storage_path)) ?? null),
          href: submissionHref(row, newBobbleheadHrefs),
        }));

        if (cancelled) return;

        setError(null);
        setSubmissions(withDetails);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client]);

  return { submissions: userId ? submissions : [], isLoading: userId ? isLoading : false, error };
}

// Favorites, wanted, and owned are each stored per-team as a boolean flag, so
// building the cross-team list for the profile page means resolving every row's
// title and image against the curated / community / approved-photo sources.
// That resolution is shared (lib/bobbleheadIdentity.ts); the three lists differ
// only in which table and flag column they read, so they share this one hook.
function useMyBobbleheadList(
  table: string,
  flag: string,
  source: ProfileSource | undefined,
) {
  const { user } = useAuth();
  const client = source?.client ?? supabase;
  const userId = source?.userId ?? user?.id ?? null;
  const [items, setItems] = useState<BobbleheadIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    // The table/flag are chosen at runtime, which the per-table generated types
    // can't express, so this one query goes through an untyped view of the
    // client. buildBobbleheadResolver below still uses the typed client.
    const untyped = client as unknown as SupabaseClient;

    untyped
      .from(table)
      .select("bobblehead_id, team_slug")
      .eq("user_id", userId)
      .eq(flag, true)
      .then(async ({ data, error: queryError }) => {
        if (cancelled) return;

        if (queryError) {
          console.error(`Failed to load ${table}:`, queryError.message);
          setError("Couldn't load this list. Please refresh.");
          setItems([]);
          setIsLoading(false);
          return;
        }

        const rows = (data ?? []) as Array<{ bobblehead_id: string; team_slug: string }>;

        if (rows.length === 0) {
          setItems([]);
          setError(null);
          setIsLoading(false);
          return;
        }

        const teamSlugs = Array.from(new Set(rows.map((row) => row.team_slug)));
        const resolve = await buildBobbleheadResolver(client, teamSlugs);

        if (cancelled) return;

        // Deleting a listing doesn't clear anyone's collection rows, so drop
        // the ones that now point at a page that 404s.
        setItems(
          rows
            .map((row) => resolve(row.team_slug, row.bobblehead_id))
            .filter((item) => !item.deleted),
        );
        setError(null);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, client, table, flag]);

  return { items: userId ? items : [], isLoading: userId ? isLoading : false, error };
}

// Structurally identical lists; the aliases keep the call sites self-documenting
// and preserve the previously-exported type names.
export type MyFavorite = BobbleheadIdentity;
export type MyWanted = BobbleheadIdentity;
export type MyOwned = BobbleheadIdentity;

export function useMyFavorites(source?: ProfileSource) {
  const { items, isLoading, error } = useMyBobbleheadList("user_favorites", "favorited", source);
  return { favorites: items, isLoading, error };
}

export function useMyWanted(source?: ProfileSource) {
  const { items, isLoading, error } = useMyBobbleheadList("user_wants", "wanted", source);
  return { wanted: items, isLoading, error };
}

// useCollectionSummary above only returns per-team *counts*; this returns the
// actual owned items, reading user_collections where owned — the exact rows
// get_public_gallery marks 'owned' — so the settings preview can show the same
// owned grid the live shelf would, without going through the is_public-gated
// public RPC.
export function useMyOwned(source?: ProfileSource) {
  const { items, isLoading, error } = useMyBobbleheadList("user_collections", "owned", source);
  return { owned: items, isLoading, error };
}

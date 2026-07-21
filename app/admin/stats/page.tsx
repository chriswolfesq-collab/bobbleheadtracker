"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { GIVEAWAYS_BY_TEAM } from "@/lib/bobbleheads";
import { useAllCommunityBobbleheads } from "@/lib/communityBobbleheads";
import { useBobbleheadOverrides } from "@/lib/bobbleheadOverrides";
import { TEAMS, getTeamBySlug } from "@/lib/teams";

type TopTeam = { slug: string; count: number };
type TeamListings = { slug: string; total: number; withPhotos: number };
type ReportedListing = {
  team_slug: string;
  bobblehead_id: string;
  title: string | null;
  count: number;
};

type DashboardStats = {
  users_total: number;
  users_signed_in: number;
  users_new_7d: number;
  users_new_30d: number;
  public_shelves: number;
  owned_total: number;
  wanted_total: number;
  favorite_total: number;
  community_total: number;
  gallery_total: number;
  pending_submissions: number;
  pending_reports: number;
  open_dead_images: number;
  pending_scraped: number;
  submissions_7d: number;
  submissions_approved_7d: number;
  submissions_rejected_7d: number;
  reports_7d: number;
  top_teams: TopTeam[];
  most_reported: ReportedListing[];
};

const nf = new Intl.NumberFormat();
const fmt = (value: number) => nf.format(value);
const teamName = (slug: string) => getTeamBySlug(slug)?.name ?? slug;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1a29] p-5">
      <p className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-black tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-sm font-black uppercase tracking-wide text-zinc-300">{children}</h2>
  );
}

export default function AdminStatsPage() {
  const { user, isAdmin, isLoading, signOut } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The per-team listing/photo breakdown mirrors the team page's own header
  // math: a team's listings are its curated catalog (baked into the app, minus
  // admin-deleted ones) plus community rows, and a listing "has a photo" if it
  // has an approved main photo or its own inline image. The curated catalog and
  // its inline images live only in TS (lib/bobbleheads.ts), so this can't be
  // computed in SQL — it's assembled client-side from the same sources the
  // team page uses. approved_photos is keyed by (team_slug, bobblehead_id).
  const { communityBobbleheads } = useAllCommunityBobbleheads();
  const overrides = useBobbleheadOverrides();
  const [approvedPhotoKeys, setApprovedPhotoKeys] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase.rpc("admin_dashboard_stats").then(({ data, error: rpcError }) => {
      if (cancelled) return;

      if (rpcError) {
        setError(rpcError.message);
      } else {
        setStats(data as DashboardStats);
      }
      setIsLoadingStats(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    supabase
      .from("approved_photos")
      .select("team_slug, bobblehead_id")
      .then(({ data, error: photoError }) => {
        if (cancelled) return;
        if (photoError) {
          setError(photoError.message);
          setApprovedPhotoKeys(new Set());
        } else {
          setApprovedPhotoKeys(
            new Set((data ?? []).map((row) => `${row.team_slug}/${row.bobblehead_id}`)),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const listingsByTeam = useMemo<TeamListings[] | null>(() => {
    if (!approvedPhotoKeys) return null;

    const communityByTeam = new Map<string, typeof communityBobbleheads>();
    for (const cb of communityBobbleheads) {
      const list = communityByTeam.get(cb.teamSlug);
      if (list) list.push(cb);
      else communityByTeam.set(cb.teamSlug, [cb]);
    }

    const hasPhoto = (slug: string, id: string, inlineUrl?: string | null) =>
      approvedPhotoKeys.has(`${slug}/${id}`) || Boolean(inlineUrl);

    return TEAMS.map((team) => {
      const curated = (GIVEAWAYS_BY_TEAM[team.slug] ?? []).filter(
        (giveaway) => !overrides.isDeleted(team.slug, giveaway.id),
      );
      const community = communityByTeam.get(team.slug) ?? [];

      let withPhotos = 0;
      for (const giveaway of curated) {
        if (hasPhoto(team.slug, giveaway.id, giveaway.imageUrl)) withPhotos += 1;
      }
      for (const cb of community) {
        if (hasPhoto(team.slug, cb.id, cb.imageUrl)) withPhotos += 1;
      }

      return { slug: team.slug, total: curated.length + community.length, withPhotos };
    })
      .filter((row) => row.total > 0)
      .sort(
        (a, b) => b.total - a.total || teamName(a.slug).localeCompare(teamName(b.slug)),
      );
  }, [approvedPhotoKeys, communityBobbleheads, overrides]);

  if (isLoading) {
    return null;
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-full bg-[#15110d] px-4 py-10 text-center text-zinc-100">
        <p className="text-sm font-black uppercase tracking-wide text-zinc-100">Not authorized</p>
        <p className="mt-2 text-sm text-zinc-400">Log in with an admin-mode account to continue.</p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded border border-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d]"
        >
          Go to admin login
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#15110d] px-4 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <Link href="/admin" className="text-sm font-black uppercase tracking-wide text-white hover:text-amber-300">
            ← Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-wide">Site stats</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-semibold text-zinc-200">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Log out
          </button>
        </div>
      </div>

      {error ? (
        <p className="mx-auto mt-6 max-w-5xl text-sm font-semibold text-red-400">{error}</p>
      ) : null}

      <div className="mx-auto max-w-5xl">
        {isLoadingStats ? (
          <p className="mt-8 text-sm text-zinc-400">Loading…</p>
        ) : !stats ? (
          !error ? <p className="mt-8 text-sm text-zinc-400">No stats available.</p> : null
        ) : (
          <>
            <SectionHeading>Listings by team</SectionHeading>
            <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1a29] p-2">
              {listingsByTeam === null ? (
                <p className="p-3 text-sm text-zinc-400">Loading…</p>
              ) : listingsByTeam.length === 0 ? (
                <p className="p-3 text-sm text-zinc-400">No listings yet.</p>
              ) : (
                <ul>
                  <li className="flex items-center gap-3 px-3 py-2 text-xs font-black uppercase tracking-wide text-zinc-400">
                    <span className="min-w-0 flex-1">Team</span>
                    <span className="w-20 shrink-0 text-right">Listings</span>
                    <span className="w-28 shrink-0 text-right">With photos</span>
                  </li>
                  {listingsByTeam.map((team) => (
                    <li
                      key={team.slug}
                      className="flex items-center gap-3 border-t border-white/5 px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/teams/${team.slug}`}
                        className="min-w-0 flex-1 truncate font-black uppercase tracking-wide text-amber-300 hover:text-amber-200"
                      >
                        {teamName(team.slug)}
                      </Link>
                      <span className="w-20 shrink-0 text-right tabular-nums text-zinc-200">
                        {fmt(team.total)}
                      </span>
                      <span className="w-28 shrink-0 text-right tabular-nums text-zinc-400">
                        {fmt(team.withPhotos)}
                        <span className="ml-1 text-xs text-zinc-500">
                          ({team.total > 0 ? Math.round((team.withPhotos / team.total) * 100) : 0}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SectionHeading>Top teams by owned</SectionHeading>
            <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1a29] p-2">
              {stats.top_teams.length === 0 ? (
                <p className="p-3 text-sm text-zinc-400">No owned bobbleheads yet.</p>
              ) : (
                <ul>
                  {stats.top_teams.map((team) => (
                    <li
                      key={team.slug}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <Link
                        href={`/teams/${team.slug}`}
                        className="font-black uppercase tracking-wide text-amber-300 hover:text-amber-200"
                      >
                        {teamName(team.slug)}
                      </Link>
                      <span className="tabular-nums text-zinc-200">{fmt(team.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SectionHeading>Accounts</SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total users" value={fmt(stats.users_total)} />
              <StatCard
                label="Signed in"
                value={fmt(stats.users_signed_in)}
                hint={`${fmt(stats.users_total - stats.users_signed_in)} never signed in`}
              />
              <StatCard label="New (7 days)" value={fmt(stats.users_new_7d)} />
              <StatCard label="New (30 days)" value={fmt(stats.users_new_30d)} />
              <StatCard label="Public shelves" value={fmt(stats.public_shelves)} />
            </div>

            <SectionHeading>Collections</SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/owned" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Owned items" value={fmt(stats.owned_total)} />
              </Link>
              <Link href="/admin/wanted" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Wanted items" value={fmt(stats.wanted_total)} />
              </Link>
              <Link href="/admin/favorited" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Favorited items" value={fmt(stats.favorite_total)} />
              </Link>
              <Link
                href="/admin/community-listings"
                className="block rounded-lg transition hover:opacity-90"
              >
                <StatCard label="Community listings" value={fmt(stats.community_total)} />
              </Link>
              <Link href="/admin/gallery-photos" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Gallery photos" value={fmt(stats.gallery_total)} />
              </Link>
            </div>

            <SectionHeading>Open queues</SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/admin/review" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Pending submissions" value={fmt(stats.pending_submissions)} />
              </Link>
              <Link href="/admin/reports" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Pending reports" value={fmt(stats.pending_reports)} />
              </Link>
              <Link href="/admin/dead-images" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Open dead images" value={fmt(stats.open_dead_images)} />
              </Link>
              <Link href="/admin/scraped-giveaways" className="block rounded-lg transition hover:opacity-90">
                <StatCard label="Scraped giveaways" value={fmt(stats.pending_scraped)} />
              </Link>
            </div>

            <SectionHeading>Last 7 days</SectionHeading>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Submissions made" value={fmt(stats.submissions_7d)} />
              <StatCard label="Submissions approved" value={fmt(stats.submissions_approved_7d)} />
              <StatCard label="Submissions rejected" value={fmt(stats.submissions_rejected_7d)} />
              <StatCard label="Reports filed" value={fmt(stats.reports_7d)} />
            </div>

            <SectionHeading>Most-reported listings</SectionHeading>
            <div className="mt-4 rounded-lg border border-white/10 bg-[#0b1a29] p-2">
              {stats.most_reported.length === 0 ? (
                <p className="p-3 text-sm text-zinc-400">No pending reports.</p>
              ) : (
                <ul>
                  {stats.most_reported.map((listing) => (
                    <li
                      key={`${listing.team_slug}-${listing.bobblehead_id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white">
                          {listing.title ?? listing.bobblehead_id}
                        </span>
                        <span className="text-xs text-zinc-500">{teamName(listing.team_slug)}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-red-500/90 px-2 py-0.5 text-xs font-black tabular-nums text-white">
                        {fmt(listing.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AwardsShelf from "@/components/AwardsShelf";
import DisplayCase from "@/components/DisplayCase";
import { ShareCollectionButton } from "@/components/ShareCollectionButton";
import { type BobbleheadIdentity } from "@/lib/bobbleheadIdentity";
import { publicAsset } from "@/lib/paths";
import {
  type MyFavorite,
  type MySubmission,
  type MyWanted,
  type ShelfSharing,
} from "@/lib/profile";
import { computeShelfStats } from "@/lib/shelfStats";
import { TEAMS } from "@/lib/teams";

// The blocks the admin read-only page is made of, in the order they appear.
// Drives both the jump nav and the scroll spy that keeps it in sync. The
// owner's own profile doesn't stack these anymore — each is a tab page under
// app/profile — so the jump nav only survives here, where everything still
// hangs on one page.
const SECTIONS = [
  { id: "collection", label: "Collection" },
  { id: "awards", label: "Awards" },
  { id: "favorites", label: "Favorites" },
  { id: "wanted", label: "Wanted" },
  { id: "submissions", label: "Submissions" },
] as const;

/**
 * Jump links to the sections below (admin read-only view only — the owner's
 * profile has real tabs instead).
 *
 * These used to be buttons that picked up a pressed look on click, which read
 * as a tab row: press one and you'd expect the other views to go away. They
 * never did — everything stays on the page and the click only scrolls. So
 * they're anchors now, and the highlight tracks what you're actually looking at
 * rather than what you last clicked. `aria-current="location"` is the same
 * statement for a screen reader: you are here, not this is selected.
 */
function SectionNav() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);
  const visibleIds = useRef(new Set<string>());

  useEffect(() => {
    const elements = SECTIONS
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    // Watch only the top 30% of the viewport: the section you're reading is the
    // first one whose body has reached the top of the screen, not whichever
    // happens to be largest on it. Several can qualify at once (a short
    // Favorites list sitting above Wanted), so document order breaks the tie.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleIds.current.add(entry.target.id);
          else visibleIds.current.delete(entry.target.id);
        }
        const current = SECTIONS.find(({ id }) => visibleIds.current.has(id));
        // No match means the band is between sections mid-scroll; keeping the
        // last one is better than blanking the nav for a frame.
        if (current) setActiveId(current.id);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Jump to a section" className="mb-8 flex flex-wrap justify-center gap-2">
      {SECTIONS.map(({ id, label }) => {
        const isCurrent = id === activeId;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={isCurrent ? "location" : undefined}
            onClick={(event) => {
              // Let a modified click open the anchor the way the browser wants
              // to; only a plain one is ours to turn into a smooth scroll.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className={`rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wide transition ${
              isCurrent
                ? "border-accent bg-accent/10 text-accent"
                : "border-black/10 bg-black/[0.04] text-zinc-700 hover:border-accent hover:text-accent-hover"
            }`}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}

const STATUS_STYLES: Record<MySubmission["status"], string> = {
  pending: "border-accent/40 bg-accent/10 text-accent",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/40 bg-red-400/10 text-red-300",
};

function submissionLabel(submission: MySubmission): string {
  if (submission.kind === "new_bobblehead") {
    return submission.title ?? "New bobblehead";
  }
  return "Photo for existing bobblehead";
}

// A failed load previously rendered identically to an empty list. This gives it
// a distinct message so "couldn't load" doesn't read as "nothing here".
function SectionError({ message }: { message: string }) {
  return <p className="text-sm font-semibold text-red-500">{message}</p>;
}

/**
 * Favorites and Wanted: the same card either way — art, title, team, and the
 * glyph that says which list it is.
 *
 * Cards rather than one full-width stack because the profile column is now as
 * wide as the shelf above it, and a single column of rows left every marker
 * stranded most of a page-width from its own title. Two or three to a row keeps
 * each card near reading width and puts the space to work.
 */
function SavedGrid({
  items,
  marker,
  markerClassName,
}: {
  items: BobbleheadIdentity[];
  /** The list's glyph — ♥ for favorites, ★ for wanted. Decorative: the section
   *  heading is what actually names the list. */
  marker: string;
  markerClassName: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const team = TEAMS.find((t) => t.slug === item.teamSlug);
        const imageSrc = item.imageUrl ?? publicAsset(`/bobbleheads/${item.teamSlug}.png`);

        return (
          <Link
            key={`${item.teamSlug}:${item.bobbleheadId}`}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/[0.04] px-4 py-3 text-sm transition hover:bg-black/[0.07]"
          >
            <Image
              src={imageSrc}
              alt=""
              width={677}
              height={1607}
              sizes="120px"
              className="h-20 w-auto flex-shrink-0 rounded object-cover drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-24"
            />
            <span className="min-w-0">
              <span className="block truncate font-bold text-zinc-900">{item.title}</span>
              <span className="text-xs text-zinc-500">{team?.name ?? item.teamSlug}</span>
            </span>
            <span aria-hidden className={`ml-auto flex-shrink-0 text-lg ${markerClassName}`}>
              {marker}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** The display case, share buttons, and progress bar. Rendered by the owner's
 *  Collection tab (app/profile) and by the admin read-only view, which omits
 *  displayName/sharing so it carries no share buttons. */
export function CollectionSection({
  countByTeamSlug,
  totalByTeamSlug,
  displayName,
  sharing,
  isCollectionLoading = false,
}: {
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  /** Whose collection this is. Omitted in the admin read-only view, which hides
   *  the share button rather than let an admin share another user's shelf. */
  displayName?: string;
  /** Omitted alongside displayName in the admin view, for the same reason. */
  sharing?: ShelfSharing;
  /** Counts still loading. Without it the share button is live over an empty
   *  collection and captures a 0/0 shelf. */
  isCollectionLoading?: boolean;
}) {
  // Shared with the public /shelf/<slug> page so a collector's own profile and
  // the link they hand out always agree on the numbers.
  const stats = computeShelfStats(countByTeamSlug, totalByTeamSlug);
  const { totalOwned, siteTotal, pctComplete, teamsStarted, slotsEmpty } = stats;

  return (
    <section id="collection" className="mb-10 scroll-mt-6">
      {/* The shelf breaks out of the profile's reading column so it hangs at
          the same width as the teams-page wall — same figures, same spacing,
          same furniture. 100vw minus a hair so a viewport scrollbar can't push
          the wall into a horizontal scroll of its own.

          The share button overlays the shelf rather than living inside
          DisplayCase: DisplayCase is also what the share card itself renders,
          so a button in there would recurse into the shared image. */}
      <div className="relative left-1/2 w-[calc(100vw-1rem)] max-w-6xl -translate-x-1/2">
        <DisplayCase countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
        {displayName && sharing ? (
          <div className="absolute right-4 top-0 z-30 text-right sm:right-6">
            <ShareCollectionButton
              variant="overlay"
              displayName={displayName}
              countByTeamSlug={countByTeamSlug}
              totalByTeamSlug={totalByTeamSlug}
              stats={stats}
              sharing={sharing}
              isLoading={isCollectionLoading}
            />
          </div>
        ) : null}
      </div>

      <div className="mb-4 mt-6 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
          Collection progress
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black tabular-nums text-accent">
            {totalOwned}/{siteTotal}
          </span>
          {displayName && sharing ? (
            <ShareCollectionButton
              displayName={displayName}
              countByTeamSlug={countByTeamSlug}
              totalByTeamSlug={totalByTeamSlug}
              stats={stats}
              sharing={sharing}
              isLoading={isCollectionLoading}
            />
          ) : null}
        </div>
      </div>

      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pctComplete}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-bold text-zinc-500">
          {pctComplete}% complete · {teamsStarted}/{TEAMS.length} teams started ·{" "}
          {slotsEmpty} slots empty
        </p>
      </div>
    </section>
  );
}

/** The awards shelf. Breaks out of the reading column to the same width as the
 *  display case — it's the same furniture and it would look shrunken hanging in
 *  a narrower stripe. */
export function AwardsSection({
  countByTeamSlug,
  totalByTeamSlug,
  awardFacts,
  isLoading = false,
  isOtherUser = false,
}: {
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  /** The award facts a collection can't imply — signup rank, rep teams, and the
   *  contribution counters. Omitted in the admin read-only view, where
   *  my_rep_teams() would answer for the admin rather than the member being
   *  looked at. */
  awardFacts?: {
    memberNumber: number | null;
    repTeams: string[];
    approvedSubmissions: number;
    qualifyingReferrals: number;
    streakMonths: number;
  };
  isLoading?: boolean;
  isOtherUser?: boolean;
}) {
  const { totalOwned, teamsStarted, teamsCompleted } = computeShelfStats(
    countByTeamSlug,
    totalByTeamSlug,
  );

  return (
    <section id="awards" className="mb-10 scroll-mt-6">
      <h2 className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">Awards</h2>
      <div className="relative left-1/2 w-[calc(100vw-1rem)] max-w-6xl -translate-x-1/2">
        <AwardsShelf
          facts={{
            totalOwned,
            teamsStarted,
            teamsCompleted,
            memberNumber: awardFacts?.memberNumber ?? null,
            repTeams: awardFacts?.repTeams ?? [],
            approvedSubmissions: awardFacts?.approvedSubmissions ?? 0,
            qualifyingReferrals: awardFacts?.qualifyingReferrals ?? 0,
            streakMonths: awardFacts?.streakMonths ?? 0,
          }}
          isLoading={isLoading}
          isOtherUser={isOtherUser}
        />
      </div>
    </section>
  );
}

export function FavoritesSection({
  favorites,
  isLoading,
  error = null,
}: {
  favorites: MyFavorite[];
  isLoading: boolean;
  /** Non-null when the load failed, so the empty state can read as an error
   *  instead of masquerading as "no favorites yet". Same on the two below. */
  error?: string | null;
}) {
  return (
    <section id="favorites" className="mb-10 scroll-mt-6">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Favorites
      </h2>
      {isLoading ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : error ? (
        <SectionError message={error} />
      ) : favorites.length === 0 ? (
        <p className="text-sm text-zinc-600">No favorites yet.</p>
      ) : (
        <SavedGrid items={favorites} marker="♥" markerClassName="text-red-400" />
      )}
    </section>
  );
}

export function WantedSection({
  wanted,
  isLoading,
  error = null,
  isOtherUser = false,
}: {
  wanted: MyWanted[];
  isLoading: boolean;
  error?: string | null;
  /** True when an admin is viewing someone else's profile, so the empty state
   *  reads "this user's" instead of the second-person "your". */
  isOtherUser?: boolean;
}) {
  return (
    <section id="wanted" className="mb-10 scroll-mt-6">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Wanted
      </h2>
      {isLoading ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : error ? (
        <SectionError message={error} />
      ) : wanted.length === 0 ? (
        <p className="text-sm text-zinc-600">
          {isOtherUser
            ? "Nothing on this user's wanted list yet."
            : "Nothing on your wanted list yet."}
        </p>
      ) : (
        <SavedGrid items={wanted} marker="★" markerClassName="text-accent" />
      )}
    </section>
  );
}

export function SubmissionsSection({
  submissions,
  isLoading,
  error = null,
}: {
  submissions: MySubmission[];
  isLoading: boolean;
  error?: string | null;
}) {
  return (
    <section id="submissions" className="mb-10 scroll-mt-6">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Submissions
      </h2>
      {isLoading ? (
        <p className="text-sm text-zinc-600">Loading…</p>
      ) : error ? (
        <SectionError message={error} />
      ) : submissions.length === 0 ? (
        <p className="text-sm text-zinc-600">Nothing submitted yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/[0.04]">
          {submissions.map((submission, index) => {
            const team = TEAMS.find((t) => t.slug === submission.teamSlug);
            const imageSrc =
              submission.imageUrl ?? publicAsset(`/bobbleheads/${submission.teamSlug}.png`);
            const rowClassName = `flex items-center justify-between gap-3 px-4 py-3 text-sm ${
              index !== submissions.length - 1 ? "border-b border-black/10" : ""
            } ${submission.href ? "transition hover:bg-black/[0.04]" : ""}`;
            const content = (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <Image
                    src={imageSrc}
                    alt=""
                    width={677}
                    height={1607}
                    sizes="120px"
                    className="h-20 w-auto flex-shrink-0 rounded object-cover drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] sm:h-24"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-zinc-900">
                      {submissionLabel(submission)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {team?.name ?? submission.teamSlug} ·{" "}
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </span>
                <span
                  className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[submission.status]}`}
                >
                  {submission.status}
                </span>
              </>
            );

            return submission.href ? (
              <Link key={submission.id} href={submission.href} className={rowClassName}>
                {content}
              </Link>
            ) : (
              <div key={submission.id} className={rowClassName}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// All the sections stacked on one page, with a jump nav and scroll spy. Only
// the admin read-only "view profile" page (app/admin/users/view) renders this
// now — the owner's own profile broke the same sections out into tab pages
// under app/profile. All data is passed in as props, driven by the
// parameterized profile hooks pointed at another user via the admin client.
export function ProfileSections({
  countByTeamSlug,
  totalByTeamSlug,
  favorites,
  isFavoritesLoading,
  favoritesError = null,
  wanted,
  isWantedLoading,
  wantedError = null,
  submissions,
  isSubmissionsLoading,
  submissionsError = null,
  isOtherUser = false,
}: {
  countByTeamSlug: Record<string, number>;
  totalByTeamSlug: Record<string, number>;
  /** True when an admin is viewing someone else's profile, so empty states read
   *  "this user's" instead of the second-person "your". */
  isOtherUser?: boolean;
  favorites: MyFavorite[];
  isFavoritesLoading: boolean;
  favoritesError?: string | null;
  wanted: MyWanted[];
  isWantedLoading: boolean;
  wantedError?: string | null;
  submissions: MySubmission[];
  isSubmissionsLoading: boolean;
  submissionsError?: string | null;
}) {
  return (
    <>
      <SectionNav />
      <CollectionSection countByTeamSlug={countByTeamSlug} totalByTeamSlug={totalByTeamSlug} />
      <AwardsSection
        countByTeamSlug={countByTeamSlug}
        totalByTeamSlug={totalByTeamSlug}
        isOtherUser={isOtherUser}
      />
      <FavoritesSection favorites={favorites} isLoading={isFavoritesLoading} error={favoritesError} />
      <WantedSection
        wanted={wanted}
        isLoading={isWantedLoading}
        error={wantedError}
        isOtherUser={isOtherUser}
      />
      <SubmissionsSection
        submissions={submissions}
        isLoading={isSubmissionsLoading}
        error={submissionsError}
      />
    </>
  );
}

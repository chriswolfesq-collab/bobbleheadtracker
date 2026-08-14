import { TEAMS } from "@/lib/teams";

export type AwardTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/** Which shelf an award hangs on. */
export type AwardCategoryId =
  | "collection"
  | "teams-started"
  | "teams-completed"
  | "contributions"
  | "referrals"
  | "streak"
  | "honors";

/**
 * How an award is decided, which is a different question from where it hangs.
 *
 * Founding and rep share the Honors shelf — both are status rather than
 * progress, and each contributes at most one award, so on their own they'd
 * each get a plank with a single trophy marooned in the middle of it. They're
 * still evaluated by completely different rules, hence this.
 */
export type AwardKind = "count" | "founding" | "rep";

export type Award = {
  id: string;
  categoryId: AwardCategoryId;
  kind: AwardKind;
  name: string;
  /** One line of flavour, shown when the award is earned. */
  blurb: string;
  icon: string;
  tier: AwardTier;
  /** The bar in words — "25 owned", "10 teams", "Member #1–100". */
  requirement: string;
  /**
   * Set on rep awards. The shelf renders that team's own bobblehead art in
   * place of the emoji, so a Dodgers rep gets a Dodgers figure standing among
   * the trophies rather than a generic badge.
   */
  teamSlug?: string;
};

/**
 * The facts every award is decided from. Assembled by the caller because the
 * two surfaces get them from different places: the profile reads the signed-in
 * session, the public shelf gets them from get_public_shelf.
 */
export type AwardFacts = {
  totalOwned: number;
  /** Teams with at least one bobblehead owned. */
  teamsStarted: number;
  /** Teams where the whole checklist is owned. */
  teamsCompleted: number;
  /**
   * Signup order, 1-based. Null when it isn't known — an older account before
   * the backfill, or a surface that doesn't expose it. Null hides the founding
   * awards rather than showing them all locked, because "not known" and "not
   * earned" are different statements and a founding member shown four grey
   * plates would read as a demotion.
   */
  memberNumber: number | null;
  /** Team slugs this member reps. Empty for everyone else. */
  repTeams: string[];
  /** Submissions of theirs an admin has approved. Pending and rejected don't count. */
  approvedSubmissions: number;
  /** Referrals that clear the raffle's own bar, not raw signups. */
  qualifyingReferrals: number;
  /** Consecutive months, ending now, in which they added something. */
  streakMonths: number;
};

export const NO_AWARD_FACTS: AwardFacts = {
  totalOwned: 0,
  teamsStarted: 0,
  teamsCompleted: 0,
  memberNumber: null,
  repTeams: [],
  approvedSubmissions: 0,
  qualifyingReferrals: 0,
  streakMonths: 0,
};

/** A UTC 'YYYY-MM' stamp, matching what collecting_months() returns. */
function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The same key, `offset` months before `date`. */
function monthKeyBefore(date: Date, offset: number): string {
  return monthKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1)));
}

/**
 * How many consecutive months, ending now, a member has added something.
 *
 * Lives here rather than in SQL because it's calendar logic with edge cases
 * worth testing, and because the profile and the public shelf must agree — both
 * run this over the same 'YYYY-MM' list (see collecting_months() in
 * supabase/awards_activity.sql).
 *
 * The current month not having anything in it yet does NOT break a streak: the
 * month isn't over. Someone who added a bobblehead in July and checks their
 * shelf on 1 August should not watch a ten-month run vanish because the new
 * month is a few hours old. So the run is allowed to end either this month or
 * last, and only a gap before that stops it.
 *
 * Everything is UTC, matching the SQL side, so a member near midnight in either
 * direction gets the same answer from both surfaces rather than a streak that
 * changes depending on which page they opened.
 */
export function computeCollectingStreak(months: readonly string[], now: Date): number {
  const seen = new Set(months);
  if (seen.size === 0) return 0;

  // Where the run is allowed to end. Anchoring on last month when the current
  // one is empty is what keeps an unfinished month from counting as a gap.
  const thisMonth = monthKey(now);
  const lastMonth = monthKeyBefore(now, 1);
  const anchorOffset = seen.has(thisMonth) ? 0 : seen.has(lastMonth) ? 1 : -1;
  if (anchorOffset === -1) return 0;

  let streak = 0;
  while (seen.has(monthKeyBefore(now, anchorOffset + streak))) streak += 1;
  return streak;
}

const TEAM_COUNT = TEAMS.length;

/**
 * How many bobbleheads you own.
 *
 * Deliberately front-loaded: the first three land inside a single afternoon of
 * ticking boxes, because the award that matters most is the one a brand-new
 * member earns before they decide whether this site is worth coming back to.
 * The gaps widen after that — by 250 the reward is the rarity, not the pace.
 */
const COLLECTION_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 1, name: "First Nod", blurb: "The one that started it.", icon: "🎉", tier: "bronze" },
  { threshold: 10, name: "Double Digits", blurb: "A shelf, not a shrine.", icon: "🔟", tier: "bronze" },
  { threshold: 25, name: "Starting Lineup", blurb: "Enough to field a roster.", icon: "⚾", tier: "silver" },
  { threshold: 50, name: "Half Century", blurb: "Fifty heads, still nodding.", icon: "🧢", tier: "silver" },
  { threshold: 100, name: "Century Club", blurb: "Triple digits. Serious now.", icon: "💯", tier: "gold" },
  { threshold: 250, name: "Big Leagues", blurb: "You need more shelves.", icon: "🏟️", tier: "gold" },
  { threshold: 500, name: "The 500 Club", blurb: "Rare air in any sport.", icon: "🏆", tier: "platinum" },
  { threshold: 750, name: "Cooperstown Bound", blurb: "A collection with a wing.", icon: "🥇", tier: "platinum" },
  { threshold: 1000, name: "Four Figures", blurb: "One thousand and counting.", icon: "👑", tier: "diamond" },
];

/** How many teams you've started — one bobblehead is enough to count. */
const TEAMS_STARTED_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 5, name: "Road Trip", blurb: "Five teams on the board.", icon: "🚌", tier: "bronze" },
  { threshold: 10, name: "Interleague", blurb: "A third of the league.", icon: "🧳", tier: "bronze" },
  { threshold: 15, name: "Halfway League", blurb: "Half the majors represented.", icon: "🗺️", tier: "silver" },
  { threshold: 20, name: "Twenty Cities", blurb: "Twenty ballparks deep.", icon: "🏙️", tier: "gold" },
  { threshold: 25, name: "Near Sweep", blurb: "Five teams left to find.", icon: "🧭", tier: "platinum" },
  {
    threshold: TEAM_COUNT,
    name: "League Wide",
    blurb: "Every team in the majors.",
    icon: "🌎",
    tier: "diamond",
  },
];

/**
 * How many teams you've *finished* — every listing on the checklist owned.
 *
 * A different order of difficulty from the ladder above: starting a team takes
 * one bobblehead, finishing one takes every giveaway that team has ever run.
 * "Perfect Game" is the first rung on purpose — completing a single team is a
 * genuine milestone and deserves to be marked, where starting a single one is
 * just signing up.
 */
const TEAMS_COMPLETED_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 1, name: "Perfect Game", blurb: "One team, every bobblehead.", icon: "🎯", tier: "silver" },
  { threshold: 5, name: "Five Complete", blurb: "Five checklists cleared.", icon: "✅", tier: "gold" },
  { threshold: 10, name: "Ten Complete", blurb: "Ten teams finished off.", icon: "🔟", tier: "gold" },
  { threshold: 15, name: "Fifteen Complete", blurb: "Half the league, finished.", icon: "🏅", tier: "platinum" },
  { threshold: 20, name: "Twenty Complete", blurb: "Twenty teams, no gaps.", icon: "💎", tier: "platinum" },
  { threshold: 25, name: "Twenty-Five Complete", blurb: "Five checklists from history.", icon: "🌟", tier: "diamond" },
  {
    threshold: TEAM_COUNT,
    name: "The Whole League",
    blurb: "Every team. Every bobblehead.",
    icon: "👑",
    tier: "diamond",
  },
];

/**
 * Where you came in.
 *
 * The only awards nobody can earn later, which is exactly the point — they
 * reward showing up early, and they get rarer on their own as the site grows.
 * The rank comes from profiles.member_number (see supabase/awards.sql), which
 * is assigned in true signup order.
 */
const FOUNDING_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 100, name: "Founding 100", blurb: "Here before almost anyone.", icon: "🌱", tier: "diamond" },
  { threshold: 250, name: "First 250", blurb: "In on the ground floor.", icon: "🔰", tier: "platinum" },
  { threshold: 500, name: "First 500", blurb: "Early to the shelf.", icon: "🎖️", tier: "gold" },
  { threshold: 1000, name: "First 1,000", blurb: "Beat the crowd here.", icon: "🕰️", tier: "silver" },
];

/**
 * What you've given back — submissions an admin approved.
 *
 * Approved, not submitted, and that distinction is the whole design: paying out
 * on submission alone rewards volume, and the one thing a community-sourced
 * checklist cannot afford is an incentive to file junk. This rewards the
 * contribution that survived review.
 */
const CONTRIBUTION_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 1, name: "First Contribution", blurb: "You added to the record.", icon: "📷", tier: "bronze" },
  { threshold: 5, name: "Shutterbug", blurb: "Five listings the better for you.", icon: "📸", tier: "silver" },
  { threshold: 10, name: "Staff Photographer", blurb: "Ten approved and counting.", icon: "🎞️", tier: "gold" },
  { threshold: 25, name: "The Archivist", blurb: "Filling in the gaps nobody else did.", icon: "🗂️", tier: "platinum" },
  { threshold: 50, name: "Site Historian", blurb: "Fifty pieces of the record are yours.", icon: "📚", tier: "diamond" },
];

/**
 * Who you brought in.
 *
 * Counted against the same bar the raffle uses — the friend confirmed their
 * email and started a shelf of their own — rather than raw signups. An award
 * for creating empty accounts would be an award for gaming it.
 */
const REFERRAL_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 1, name: "Word of Mouth", blurb: "You brought someone in.", icon: "🗣️", tier: "bronze" },
  { threshold: 3, name: "Recruiter", blurb: "Three shelves that wouldn't exist.", icon: "🤝", tier: "silver" },
  { threshold: 5, name: "Ambassador", blurb: "Five collectors, thanks to you.", icon: "📣", tier: "gold" },
  { threshold: 10, name: "Talent Scout", blurb: "Ten found and signed.", icon: "🔭", tier: "platinum" },
  { threshold: 25, name: "Franchise Builder", blurb: "You built a wing of this place.", icon: "🏗️", tier: "diamond" },
];

/**
 * Months in a row you added something.
 *
 * The only ladder that can go backwards, and the only one that rewards pace
 * rather than total — which is the point. A collection of 800 says what you did
 * once; a twelve-month streak says you're still doing it.
 */
const STREAK_THRESHOLDS: {
  threshold: number;
  name: string;
  blurb: string;
  icon: string;
  tier: AwardTier;
}[] = [
  { threshold: 3, name: "Warming Up", blurb: "Three months on the trot.", icon: "🔥", tier: "bronze" },
  { threshold: 6, name: "Half a Year", blurb: "Six straight months of finds.", icon: "📆", tier: "silver" },
  { threshold: 12, name: "Year-Rounder", blurb: "Twelve months, no gaps.", icon: "🗓️", tier: "gold" },
  { threshold: 24, name: "Two Seasons Deep", blurb: "Two years without missing a month.", icon: "⏳", tier: "platinum" },
];

export const AWARD_CATEGORIES: {
  id: AwardCategoryId;
  label: string;
  /** Sits on the shelf plaque under the planks. */
  plaque: string;
}[] = [
  { id: "collection", label: "Collection", plaque: "Collection" },
  { id: "teams-started", label: "Teams started", plaque: "Teams Started" },
  { id: "teams-completed", label: "Teams completed", plaque: "Teams Completed" },
  { id: "contributions", label: "Contributions", plaque: "Contributions" },
  { id: "referrals", label: "Referrals", plaque: "Referrals" },
  { id: "streak", label: "Streak", plaque: "Streak" },
  { id: "honors", label: "Honors", plaque: "Honors" },
];

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

/** The full catalog, in shelf order. Stable ids — the celebration remembers them. */
export const AWARDS: Award[] = [
  ...COLLECTION_THRESHOLDS.map<Award>((rung, index) => ({
    id: `owned-${rung.threshold}`,
    categoryId: "collection",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    // The top rung reads "1,000+" because it's the end of the ladder — there's
    // no rung above it to make an exact number mean anything.
    requirement: `${rung.threshold.toLocaleString()}${
      index === COLLECTION_THRESHOLDS.length - 1 ? "+" : ""
    } owned`,
  })),
  ...TEAMS_STARTED_THRESHOLDS.map<Award>((rung) => ({
    id: `teams-started-${rung.threshold}`,
    categoryId: "teams-started",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement: rung.threshold === TEAM_COUNT ? "All 30 teams" : plural(rung.threshold, "team"),
  })),
  ...TEAMS_COMPLETED_THRESHOLDS.map<Award>((rung) => ({
    id: `teams-completed-${rung.threshold}`,
    categoryId: "teams-completed",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement:
      rung.threshold === TEAM_COUNT ? "All 30 finished" : `${plural(rung.threshold, "team")} finished`,
  })),
  ...CONTRIBUTION_THRESHOLDS.map<Award>((rung) => ({
    id: `contributions-${rung.threshold}`,
    categoryId: "contributions",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement: `${plural(rung.threshold, "submission")} approved`,
  })),
  ...REFERRAL_THRESHOLDS.map<Award>((rung) => ({
    id: `referrals-${rung.threshold}`,
    categoryId: "referrals",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement: plural(rung.threshold, "friend"),
  })),
  ...STREAK_THRESHOLDS.map<Award>((rung) => ({
    id: `streak-${rung.threshold}`,
    categoryId: "streak",
    kind: "count",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement: `${plural(rung.threshold, "month")} in a row`,
  })),
  ...FOUNDING_THRESHOLDS.map<Award>((rung) => ({
    id: `founding-${rung.threshold}`,
    categoryId: "honors",
    kind: "founding",
    name: rung.name,
    blurb: rung.blurb,
    icon: rung.icon,
    tier: rung.tier,
    requirement: `Member #1–${rung.threshold.toLocaleString()}`,
  })),
];

/**
 * The rep award for one team, or null if the slug isn't a real franchise.
 *
 * Built per member rather than sitting in the static catalog above, because
 * there is no one "Team Rep" award — a Dodgers rep earns a Dodgers award, and
 * someone who reps two teams earns both. The figure is that team's own
 * bobblehead art (see Award.teamSlug), which is what makes each one distinct
 * on the shelf rather than thirty identical badges with different captions.
 *
 * The null case is real, not defensive: team_reps.team_slug is deliberately
 * free text (teams live in lib/teams.ts, not a table), so a typo'd or retired
 * slug reaches here and must not render a nameless trophy.
 */
export function repAwardFor(teamSlug: string): Award | null {
  const team = TEAMS.find((candidate) => candidate.slug === teamSlug);
  if (!team) return null;

  return {
    id: `team-rep-${team.slug}`,
    categoryId: "honors",
    kind: "rep",
    name: `${team.name} Rep`,
    blurb: `Keeping the ${team.city} ${team.name} checklist honest.`,
    // Never rendered on the shelf — teamSlug wins there — but the celebration
    // and any text-only surface still need something to show.
    icon: "🎽",
    tier: "diamond",
    requirement: `${team.name} team rep`,
    teamSlug: team.slug,
  };
}

export type AwardState = Award & {
  earned: boolean;
  /**
   * What's left, in words — "20 to go", "3 teams to go". Null when there's
   * nothing to count down: a founding award is decided the day you sign up,
   * and rep is decided by an appointment.
   */
  progressLabel: string | null;
};

export type AwardCategoryState = {
  id: AwardCategoryId;
  label: string;
  plaque: string;
  awards: AwardState[];
  earnedCount: number;
};

export type AwardProgress = {
  categories: AwardCategoryState[];
  /** Every award, flat, in shelf order — the celebration diffs against this. */
  awards: AwardState[];
  earnedCount: number;
  /** How many are on offer for this member. Excludes categories that don't apply. */
  totalCount: number;
  /** The best thing they've got, for a one-line summary. */
  latest: Award | null;
  /** The nearest countable award still ahead, with how far away it is. */
  next: { award: Award; progressLabel: string } | null;
};

/**
 * Which awards a member has earned, and what's next.
 *
 * Shared by the profile, the public shelf and the unlock celebration so all
 * three agree — a member who sees "6 to go" on their profile and a different
 * number on their public link would rightly not trust either.
 */
export function evaluateAwards(facts: AwardFacts): AwardProgress {
  // These arrive from a network read and a subtraction (deleted listings), so
  // they're worth not trusting: NaN would make every comparison false and
  // silently hide the whole shelf.
  const owned = clampCount(facts.totalOwned);
  const started = clampCount(facts.teamsStarted);
  const completed = clampCount(facts.teamsCompleted);
  const submissions = clampCount(facts.approvedSubmissions);
  const referrals = clampCount(facts.qualifyingReferrals);
  const streak = clampCount(facts.streakMonths);
  const memberNumber =
    facts.memberNumber !== null && Number.isFinite(facts.memberNumber) && facts.memberNumber > 0
      ? Math.floor(facts.memberNumber)
      : null;
  // One award per team repped, in league order rather than the order the rows
  // came back, so a two-team rep's shelf doesn't reshuffle between loads.
  const repAwards = TEAMS.map((team) => team.slug)
    .filter((slug) => facts.repTeams.includes(slug))
    .map(repAwardFor)
    .filter((award): award is Award => award !== null);

  const states = [...AWARDS, ...repAwards].map<AwardState>((award) => {
    // Rep awards only exist for teams this member actually reps, so reaching
    // here at all means it's earned.
    if (award.kind === "rep") return { ...award, earned: true, progressLabel: null };
    if (award.kind === "founding") {
      return {
        ...award,
        earned: memberNumber !== null && memberNumber <= thresholdOf(award),
        progressLabel: null,
      };
    }
    switch (award.categoryId) {
      case "teams-started":
        return countdown(award, started, "team");
      case "teams-completed":
        return countdown(award, completed, "team");
      case "contributions":
        return countdown(award, submissions, "submission");
      case "referrals":
        return countdown(award, referrals, "friend");
      case "streak":
        return countdown(award, streak, "month");
      default:
        return countdown(award, owned, "");
    }
  });

  // Which of these a member can actually see.
  //
  // Rep needs no filter — the awards are built from the teams this member
  // actually reps, so a non-rep simply has none. That's deliberate: thirty grey
  // team plates would be telling someone about a job they can't apply for.
  //
  // Founding is filtered to the single tightest band earned. The bands nest, so
  // member #50 clears all four, and four plates saying the same fact is a wall
  // of noise where "Founding 100" alone says everything. The unearned bands are
  // dropped rather than greyed for the same reason as rep: a member who joined
  // late can never win them, and a standing row of them is a running reminder
  // of arriving late rather than an incentive.
  const tightestFounding = states.find((award) => award.kind === "founding" && award.earned);

  const visible = states.filter((award) => {
    if (award.kind === "founding") return award.id === tightestFounding?.id;
    return true;
  });

  const categories = AWARD_CATEGORIES.map<AwardCategoryState>((category) => {
    const awards = visible.filter((award) => award.categoryId === category.id);
    return {
      ...category,
      awards,
      earnedCount: awards.filter((award) => award.earned).length,
    };
  }).filter((category) => category.awards.length > 0);

  const earned = visible.filter((award) => award.earned);
  // Only countable awards can be "next" — there's no chasing a founding band.
  const next = visible.find(
    (award): award is AwardState & { progressLabel: string } =>
      !award.earned && award.progressLabel !== null,
  );

  return {
    categories,
    awards: visible,
    earnedCount: earned.length,
    totalCount: visible.length,
    // Last in shelf order rather than "highest tier": the catalog is already
    // ordered so that later means harder within a category, and the last thing
    // earned is the thing worth crowing about.
    latest: earned.length > 0 ? earned[earned.length - 1] : null,
    next: next ? { award: next, progressLabel: next.progressLabel } : null,
  };
}

function clampCount(value: number): number {
  return Number.isFinite(value) ? Math.max(Math.floor(value), 0) : 0;
}

/** The number baked into an award's id, e.g. 250 from "owned-250". */
function thresholdOf(award: Award): number {
  return Number.parseInt(award.id.slice(award.id.lastIndexOf("-") + 1), 10);
}

function countdown(award: Award, current: number, noun: string): AwardState {
  const threshold = thresholdOf(award);
  const remaining = Math.max(threshold - current, 0);

  return {
    ...award,
    earned: current >= threshold,
    progressLabel:
      remaining === 0
        ? null
        : noun
          ? `${plural(remaining, noun)} to go`
          : `${remaining.toLocaleString()} to go`,
  };
}

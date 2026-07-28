import type { Metadata } from "next";
import Image from "next/image";
import { FeatureStrip } from "@/components/FeatureStrip";
import { HomeWelcomeModal } from "@/components/HomeWelcomeModal";
import RecentlyAdded from "@/components/RecentlyAdded";
import { TeamCard } from "@/components/TeamCard";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { publicAsset } from "@/lib/paths";
import { TEAMS } from "@/lib/teams";

// The homepage otherwise inherits the layout's generic title; give it a
// canonical title/description and let the file-based app/opengraph-image.png
// supply the share card (file metadata outranks anything declared here).
const title = "BobbleShelf — every MLB stadium giveaway bobblehead";
const description =
  "The most comprehensive database of MLB bobbleheads, built by collectors, for collectors. All 30 teams, every stadium giveaway, in one place.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, type: "website", url: "/" },
  twitter: { card: "summary_large_image", title, description },
};

// Hand-picked figures for the hero shelf; a cross-section of classic looks.
const HERO_SHELF_SLUGS = [
  "yankees",
  "dodgers",
  "red-sox",
  "cubs",
  "giants",
  "braves",
  "astros",
  "mariners",
];

// The hero artwork (public/hero-shelf.jpg, 2151x659) is a photographed display
// case: a cream pin-board panel on the left and a lit shelf on the right.
// These percentages locate those regions so the text overlay sits inside the
// left panel and the figures stand exactly on the shelf ledge.
const HERO_TEXT_BOX = { left: "4.5%", top: "12%", width: "28.5%", height: "78%" };
const HERO_SHELF_BOX = { left: "39.5%", right: "4.5%", bottom: "49%", height: "33%" };

export default function Home() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <HomeWelcomeModal />

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {/* Hero display case: photographed shelf artwork with the pitch
            overlaid on its left panel and figures standing on its shelf.
            On small screens the panel is too small to hold text, so the same
            pitch renders above the artwork instead. */}
        <section aria-label="Celebrate the art of the bobble">
          <div className="flex flex-col items-start rounded-xl border border-border-soft bg-surface px-6 py-8 md:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brass">
              Track. Collect. Share.
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-[1.05] tracking-wide text-navy">
              Celebrate the art of the bobble.
            </h1>
            <p className="mt-4 max-w-md text-base leading-6 text-zinc-600">
              The most comprehensive database of bobbleheads, built by
              collectors, for collectors.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/teams">Browse Teams</ButtonLink>
              <ButtonLink href="/search" variant="outline">
                Browse All
              </ButtonLink>
            </div>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-xl shadow-lg md:mt-0">
            <Image
              src={publicAsset("/hero-shelf.jpg")}
              alt="A lit wooden display case with a shelf of bobbleheads"
              width={2151}
              height={659}
              priority
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="h-auto w-full"
            />

            {/* Pitch inside the left pin-board panel (md+) */}
            <div
              className="absolute hidden flex-col items-start justify-center md:flex"
              style={HERO_TEXT_BOX}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brass lg:text-xs">
                Track. Collect. Share.
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold uppercase leading-[1.05] tracking-wide text-navy lg:text-4xl">
                Celebrate the art of the bobble.
              </h1>
              <p className="mt-2 hidden max-w-sm text-sm leading-5 text-zinc-600 lg:block">
                The most comprehensive database of bobbleheads, built by
                collectors, for collectors.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 lg:mt-5 lg:gap-3">
                <ButtonLink href="/teams" size="sm">
                  Browse Teams
                </ButtonLink>
                <ButtonLink href="/search" variant="outline" size="sm">
                  Browse All
                </ButtonLink>
              </div>
            </div>

            {/* Figures standing on the shelf ledge */}
            <div
              className="absolute flex items-end justify-center gap-[1.5%]"
              style={HERO_SHELF_BOX}
            >
              {HERO_SHELF_SLUGS.map((slug, index) => (
                <Image
                  key={slug}
                  src={publicAsset(`/bobbleheads/${slug}.png`)}
                  alt=""
                  aria-hidden
                  width={135}
                  height={321}
                  priority={index < 4}
                  className="h-full w-auto object-contain drop-shadow-[0_6px_6px_rgba(30,20,10,0.5)]"
                />
              ))}
            </div>
          </div>
        </section>

        <FeatureStrip className="mt-6" />

        {/* Browse by team */}
        <section className="mt-10">
          <SectionHeading
            title="Browse by Team"
            viewAllHref="/teams"
            viewAllLabel="View All Teams"
          />
          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
            {TEAMS.map((team, index) => (
              <TeamCard
                key={team.slug}
                team={team}
                eager={index < 8}
                className="w-36 shrink-0"
              />
            ))}
          </div>
        </section>

        {/* Recently added */}
        <section className="mt-10 pb-16">
          <RecentlyAdded />
        </section>
      </div>
    </div>
  );
}

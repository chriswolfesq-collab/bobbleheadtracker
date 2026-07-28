import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FeatureStrip } from "@/components/FeatureStrip";
import { HomeWelcomeModal } from "@/components/HomeWelcomeModal";
import { JoinCommunityBand } from "@/components/JoinCommunityBand";
import RecentlyAdded from "@/components/RecentlyAdded";
import { ShelfItem, ShelfRow } from "@/components/ShelfRow";
import { ButtonLink } from "@/components/ui/Button";
import { NamePlate } from "@/components/ui/NamePlate";
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

// The hero artwork (public/hero-shelf.jpg, 1024x480) is a photographed display
// case: a tall pin-board panel on the left and a lit shelf on the right with
// an "EST. 1969" plaque and props below it. These percentages locate those
// regions so the pitch sits inside the left panel and the figures stand
// exactly on the lit shelf's ledge.
const HERO_TEXT_BOX = { left: "6%", top: "8%", width: "27%", height: "84%" };
const HERO_SHELF_BOX = { left: "40.5%", right: "3.5%", bottom: "46%", height: "40%" };

const TEAM_CAPTION_HEIGHT = 44;

export default function Home() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <HomeWelcomeModal />

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {/* Hero display case: photographed shelf artwork with the pitch
            overlaid on its left panel and figures standing on its lit shelf.
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
              width={1024}
              height={480}
              preload
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
              <h1 className="mt-2 font-display text-3xl font-bold uppercase leading-[1.05] tracking-wide text-navy lg:text-4xl">
                Celebrate the art of the bobble.
              </h1>
              <p className="mt-3 text-sm leading-5 text-zinc-600">
                The most comprehensive database of bobbleheads, built by
                collectors, for collectors.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 lg:mt-6 lg:gap-3">
                <ButtonLink href="/teams" size="sm">
                  Browse Teams
                </ButtonLink>
                <ButtonLink href="/search" variant="outline" size="sm">
                  Browse All
                </ButtonLink>
              </div>
            </div>

            {/* Figures standing on the lit shelf's ledge */}
            <div
              className="absolute flex items-end justify-center gap-[2%]"
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
                  // Eager rather than preloaded: these are several images, any
                  // of which could be the LCP element depending on viewport,
                  // and preloading a set of them competes with the hero itself.
                  loading={index < 4 ? "eager" : "lazy"}
                  className="h-full w-auto object-contain drop-shadow-[0_6px_6px_rgba(30,20,10,0.5)]"
                />
              ))}
            </div>
          </div>
        </section>

        <FeatureStrip className="mt-6" />

        {/* Browse by team: all 30 figures on a shelf */}
        <section className="mt-12">
          <SectionHeading
            title="Browse by Team"
            viewAllHref="/teams"
            viewAllLabel="View All Teams"
          />
          <ShelfRow captionHeight={TEAM_CAPTION_HEIGHT} className="mt-6">
            {TEAMS.map((team, index) => (
              <ShelfItem
                key={team.slug}
                captionHeight={TEAM_CAPTION_HEIGHT}
                visual={
                  <Link
                    href={`/teams/${team.slug}`}
                    className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Image
                      src={publicAsset(`/bobbleheads/${team.slug}.png`)}
                      alt={`${team.city} ${team.name} bobblehead`}
                      width={135}
                      height={321}
                      loading={index < 10 ? "eager" : "lazy"}
                      className="h-24 w-auto object-contain drop-shadow-[0_8px_8px_rgba(58,36,18,0.35)] transition group-hover:animate-bobble sm:h-28"
                    />
                  </Link>
                }
                caption={
                  <Link
                    href={`/teams/${team.slug}`}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <NamePlate className="w-24 truncate sm:w-28">{team.name}</NamePlate>
                  </Link>
                }
              />
            ))}
          </ShelfRow>
        </section>

        {/* Recently added: community items on a shelf */}
        <section className="mt-12">
          <RecentlyAdded />
        </section>

        <div className="mt-12 pb-16">
          <JoinCommunityBand />
        </div>
      </div>
    </div>
  );
}

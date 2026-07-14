import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { TEAMS, getTeamBySlug } from "@/lib/teams";
import { GiveawayCard, OwnedCount, OwnershipProvider } from "./GiveawayCard";

const establishedBySlug: Record<string, string> = {
  angels: "1961",
  astros: "1962",
  athletics: "1901",
  "blue-jays": "1977",
  braves: "1871",
  brewers: "1969",
  cardinals: "1882",
  cubs: "1876",
  diamondbacks: "1998",
  dodgers: "1884",
  giants: "1883",
  guardians: "1901",
  mariners: "1977",
  marlins: "1993",
  mets: "1962",
  nationals: "1969",
  orioles: "1901",
  padres: "1969",
  phillies: "1883",
  pirates: "1882",
  rangers: "1961",
  rays: "1998",
  "red-sox": "1901",
  reds: "1882",
  rockies: "1993",
  royals: "1969",
  tigers: "1901",
  twins: "1901",
  "white-sox": "1901",
  yankees: "1901",
};

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center text-3xl text-zinc-200">{icon}</div>
      <div>
        <div className="text-3xl font-black leading-none text-amber-400">{value}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-200">{label}</div>
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return TEAMS.map((team) => ({ slug: team.slug }));
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) notFound();

  const giveaways = getGiveawaysByTeamSlug(team.slug);
  const photoCount = giveaways.filter((giveaway) => giveaway.imageUrl).length;

  return (
    <OwnershipProvider giveaways={giveaways}>
      <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-[#08131f] shadow-2xl">
        <section
          className="grid gap-6 border-b border-white/10 p-5 lg:grid-cols-[220px_1fr]"
          style={{
            background: `radial-gradient(circle at 74% 14%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
          }}
        >
          <aside className="lg:border-r lg:border-white/10 lg:pr-5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
            >
              <span aria-hidden>←</span>
              Back to shelf
            </Link>

            <div className="mt-5 rounded border border-white/15 bg-black/25 p-3 text-center">
              <div className="flex h-48 items-end justify-center rounded bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.18),rgba(255,255,255,0)_46%)]">
                <Image
                  src={`/bobbleheads/${team.slug}.png`}
                  alt={`${team.city} ${team.name} bobblehead`}
                  width={268}
                  height={630}
                  priority
                  className="h-44 w-auto drop-shadow-[0_12px_16px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide">
                {team.name}
              </div>
            </div>
          </aside>

          <div className="grid gap-7 xl:grid-cols-[1fr_210px]">
            <div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div
                  className="grid h-24 w-24 shrink-0 place-items-center text-4xl font-black text-white"
                  style={{ color: team.secondary === "#FFFFFF" ? "#f8fafc" : team.secondary }}
                >
                  {team.abbr}
                </div>
                <div>
                  <h1 className="text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-5xl 2xl:text-6xl">
                    {team.city} {team.name}
                  </h1>
                  <p className="mt-3 text-xl font-black uppercase tracking-wide text-amber-400">
                    {team.league} {team.division}
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-6 sm:grid-cols-3">
                <Stat icon={<span>♟</span>} value={giveaways.length} label="Bobbleheads" />
                <Stat icon={<span>✓</span>} value={<OwnedCount />} label="Owned" />
                <Stat icon={<span>▣</span>} value={photoCount} label="Photos" />
              </div>
            </div>

            <div className="flex flex-col items-start gap-6 xl:items-end">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:border-amber-400 hover:text-amber-300"
              >
                <span>✎</span>
                Edit team
              </button>
              <div className="space-y-3 text-left xl:text-right">
                <p className="text-sm font-black uppercase tracking-wide text-zinc-200">ⓘ Team info</p>
                <div className="pt-4 text-sm leading-7 text-zinc-200">
                  <p className="uppercase">Est. {establishedBySlug[team.slug] ?? "1901"}</p>
                  <p>
                    {team.city}, {team.league} {team.division}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="m-2 rounded-lg border border-white/10 bg-[#0b1a29] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:m-3 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-black uppercase tracking-wide text-zinc-100">SGA Bobbleheads</h2>
            <button
              type="button"
              className="inline-flex items-center justify-start gap-2 self-start text-sm font-bold uppercase tracking-wide text-zinc-100 sm:self-auto"
            >
              Sort: Release date (newest)
              <span className="text-lg">⌄</span>
            </button>
          </div>

          {giveaways.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {giveaways.map((giveaway, index) => (
                <GiveawayCard
                  key={giveaway.id}
                  giveaway={giveaway}
                  team={team}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
              <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
                No bobbleheads added yet
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Add a team spreadsheet to fill this page.
              </p>
            </div>
          )}
        </section>
      </div>
      </main>
    </OwnershipProvider>
  );
}

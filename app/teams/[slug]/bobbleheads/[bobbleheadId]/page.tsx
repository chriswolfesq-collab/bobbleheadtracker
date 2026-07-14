import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GIVEAWAYS_BY_TEAM, getGiveawayById } from "@/lib/bobbleheads";
import { getTeamBySlug } from "@/lib/teams";

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-full min-h-14 w-full place-items-center rounded-lg border border-white/15 bg-white/[0.03] text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-300"
    >
      {children}
    </button>
  );
}

export function generateStaticParams() {
  return Object.entries(GIVEAWAYS_BY_TEAM).flatMap(([slug, giveaways]) =>
    giveaways.map((giveaway) => ({
      slug,
      bobbleheadId: giveaway.id,
    })),
  );
}

export default async function BobbleheadPage({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}) {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  const giveaway = getGiveawayById(bobbleheadId, slug);

  if (!team || !giveaway) notFound();

  const imageSrc = giveaway.imageUrl ?? `/bobbleheads/${team.slug}.png`;
  const photoSlots = Array.from({ length: 3 }, (_, index) => index + 1);
  const uploadedPhotoCount = giveaway.imageUrl ? 1 : 0;
  const description = `Special ${giveaway.title} giveaway bobblehead featuring the ${team.city} ${team.name}.`;
  const details = [
    ["Release Date", giveaway.date],
    ["Venue", team.slug === "dodgers" ? "Dodger Stadium" : `${team.city} Ballpark`],
    ["Event", `${giveaway.title} Night`],
    ["Sculptor", "SGA"],
    ["Edition Size", "12,000"],
    ["Team", `${team.city} ${team.name}`],
    ["Theme", giveaway.title],
    ["Pose", "Holding bat"],
  ];

  return (
    <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-[#08131f] shadow-2xl">
        <section
          className="grid gap-6 border-b border-white/10 p-5 lg:grid-cols-[190px_1fr]"
          style={{
            background: `radial-gradient(circle at 72% 10%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
          }}
        >
          <aside className="lg:border-r lg:border-white/10 lg:pr-5">
            <Link
              href={`/teams/${team.slug}`}
              className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
            >
              <span aria-hidden>←</span>
              Back to team
            </Link>

            <div className="mt-5 rounded border border-white/15 bg-black/25 p-3 text-center">
              <div className="flex h-44 items-end justify-center rounded bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.18),rgba(255,255,255,0)_46%)]">
                <Image
                  src={imageSrc}
                  alt={`${team.city} ${team.name} ${giveaway.title} bobblehead`}
                  width={268}
                  height={630}
                  priority
                  className="h-40 w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide">
                {team.name}
              </div>
            </div>
          </aside>

          <div className="grid gap-6 xl:grid-cols-[1fr_210px]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">
                {team.city} {team.name}
              </p>
              <h1 className="mt-3 text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-5xl 2xl:text-6xl">
                {giveaway.title} {giveaway.year}
              </h1>
              <dl className="mt-6 grid max-w-4xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</dt>
                    <dd className="mt-1 truncate text-base font-semibold text-zinc-100">{value}</dd>
                  </div>
                ))}
                <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                  <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">Description</dt>
                  <dd className="mt-1 max-w-3xl text-base leading-6 text-zinc-200">{description}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col items-start gap-4 xl:items-end">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:border-amber-400 hover:text-amber-300"
              >
                <span>✎</span>
                Edit bobblehead
              </button>
              <p className="text-sm leading-6 text-zinc-300 xl:text-right">
                Add the photo, condition, and pickup details you want saved with this bobblehead.
              </p>
            </div>
          </div>
        </section>

        <section className="m-2 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:m-3 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-white">Photos ({uploadedPhotoCount})</p>
              <p className="mt-1 text-sm text-zinc-400">Ownership photos and pickup details</p>
            </div>
            <button type="button" className="text-sm font-black uppercase tracking-wide text-zinc-300 hover:text-amber-300">
              Notes
            </button>
          </div>
          <div className="space-y-5">
            {!giveaway.owned ? (
              <div className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-4">
                <p className="text-sm font-black uppercase tracking-wide text-amber-300">
                  Mark this one as owned
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  This is where the ownership flow will collect photos, condition, notes, and pickup details.
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photoSlots.map((slot) => (
                <div
                  key={slot}
                  className="overflow-hidden rounded-lg border border-dashed border-zinc-500/70 bg-black/20 transition hover:border-amber-400/70"
                >
                  <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 px-5 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-lg border border-white/15 bg-white/[0.04] text-2xl text-zinc-200">
                      ▣
                    </span>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wide text-white">Upload image</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">Photo slot {slot}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-center border-t border-white/10 bg-[#0c1826] px-3 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:text-amber-300"
                  >
                    Choose photo
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-400/70 px-5 py-5 text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              <span className="text-3xl">▣</span>
              <span className="mt-1 text-lg font-black uppercase tracking-wide">Add photos</span>
              <span className="mt-1 text-sm text-zinc-300">Drag and drop or click to upload</span>
            </button>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_56px]">
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-5 py-4 text-base font-black uppercase tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:bg-amber-400"
              >
                {giveaway.owned ? "Owned" : "Mark as owned"}
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-5 py-4 text-base font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                <span>✎</span>
                Edit bobblehead
              </button>
              <IconButton label="More actions">
                <span className="text-xl leading-none">...</span>
              </IconButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

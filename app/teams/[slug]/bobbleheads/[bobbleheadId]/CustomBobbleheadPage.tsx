"use client";

import Link from "next/link";
import {
  UploadedBobbleheadImage,
  UploadedPhotoCount,
  UploadPhotoButton,
} from "@/components/UploadedBobbleheadImage";
import { useCustomBobblehead } from "@/lib/customBobbleheads";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";

export function CustomBobbleheadPage({
  bobbleheadId,
  team,
}: {
  bobbleheadId: string;
  team: Team;
}) {
  const { customBobblehead: giveaway, hasLoaded } = useCustomBobblehead(team.slug, bobbleheadId);

  if (!hasLoaded) {
    return (
      <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-3xl rounded-xl border border-black bg-[#08131f] p-6 shadow-2xl">
          <Link
            href={`/teams/${team.slug}`}
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
          >
            <span aria-hidden>←</span>
            Back to team
          </Link>
          <div className="mt-8 rounded-lg border border-white/15 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
              Loading bobblehead
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!giveaway) {
    return (
      <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-3xl rounded-xl border border-black bg-[#08131f] p-6 shadow-2xl">
          <Link
            href={`/teams/${team.slug}`}
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-amber-300"
          >
            <span aria-hidden>←</span>
            Back to team
          </Link>
          <div className="mt-8 rounded-lg border border-dashed border-white/15 bg-black/15 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
              Bobblehead not found
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This custom bobblehead is not saved in this browser.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const imageSrc = publicAsset(`/bobbleheads/${team.slug}.png`);
  const description = `Custom ${giveaway.title} bobblehead saved for the ${team.city} ${team.name}.`;
  const details = [
    ["Release Date", giveaway.date],
    ["Venue", `${team.city} Ballpark`],
    ["Event", `${giveaway.title} Night`],
    ["Sculptor", "Custom"],
    ["Edition Size", "Unknown"],
    ["Team", `${team.city} ${team.name}`],
    ["Theme", giveaway.title],
    ["Pose", "Custom"],
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
                <UploadedBobbleheadImage
                  bobbleheadId={giveaway.id}
                  fallbackSrc={imageSrc}
                  alt={`${team.city} ${team.name} ${giveaway.title} bobblehead`}
                  width={268}
                  height={630}
                  priority
                  className="h-40 w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide">
                Custom
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
              <span className="rounded-lg border border-amber-400/60 px-5 py-3 text-sm font-bold uppercase tracking-wide text-amber-300">
                Custom entry
              </span>
              <p className="text-sm leading-6 text-zinc-300 xl:text-right">
                Add photos and ownership details for the bobblehead you saved.
              </p>
            </div>
          </div>
        </section>

        <section className="m-2 rounded-lg border border-white/10 bg-[#0b1a29] p-4 sm:m-3 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-white">
                Photos (<UploadedPhotoCount bobbleheadId={giveaway.id} initialCount={0} />)
              </p>
              <p className="mt-1 text-sm text-zinc-400">Ownership photos and pickup details</p>
            </div>
          </div>

          <UploadPhotoButton
            bobbleheadId={giveaway.id}
            label="Add photos"
            className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-400/70 px-5 py-5 text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            <span className="text-3xl">▣</span>
            <span className="mt-1 text-lg font-black uppercase tracking-wide">Add photos</span>
            <span className="mt-1 text-sm text-zinc-300">Drag and drop or click to upload</span>
          </UploadPhotoButton>
        </section>
      </div>
    </main>
  );
}

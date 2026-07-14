import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TEAMS, getTeamBySlug } from "@/lib/teams";
import { CommunityBobbleheadPage } from "./CommunityBobbleheadPage";

export function generateStaticParams() {
  return TEAMS.map((team) => ({ slug: team.slug }));
}

function CommunityBobbleheadLoading() {
  return (
    <main className="min-h-full bg-[#15110d] px-3 py-3 text-zinc-100 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-3xl rounded-xl border border-black bg-[#08131f] p-6 shadow-2xl">
        <div className="rounded-lg border border-white/15 bg-black/15 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-zinc-100">
            Loading bobblehead
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);

  if (!team) notFound();

  return (
    <Suspense fallback={<CommunityBobbleheadLoading />}>
      <CommunityBobbleheadPage team={team} />
    </Suspense>
  );
}

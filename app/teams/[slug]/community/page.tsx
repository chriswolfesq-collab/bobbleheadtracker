import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getTeamBySlug } from "@/lib/teams";
import { CommunityBobbleheadPage } from "./CommunityBobbleheadPage";

function CommunityBobbleheadLoading() {
  return (
    <main className="min-h-full bg-slate-50 px-3 py-3 text-zinc-900 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-3xl rounded-xl border border-black bg-white p-6 shadow-2xl">
        <div className="rounded-lg border border-black/10 bg-black/15 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-zinc-900">
            Loading bobblehead
          </p>
        </div>
      </div>
    </main>
  );
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { slug } = await params;
  const { id } = await searchParams;
  const team = getTeamBySlug(slug);

  if (!team) notFound();

  // Legacy ?id= links move to the crawlable per-listing route.
  if (id) redirect(`/teams/${slug}/community/${encodeURIComponent(id)}`);

  return (
    <Suspense fallback={<CommunityBobbleheadLoading />}>
      <CommunityBobbleheadPage team={team} />
    </Suspense>
  );
}

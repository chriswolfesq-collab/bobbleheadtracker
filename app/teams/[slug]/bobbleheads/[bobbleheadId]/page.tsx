import { notFound } from "next/navigation";
import { GIVEAWAYS_BY_TEAM, getGiveawayById } from "@/lib/bobbleheads";
import { getCuratedListingData } from "@/lib/curatedListing";
import { getTeamBySlug } from "@/lib/teams";
import { CuratedBobbleheadPage } from "./CuratedBobbleheadPage";

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

  const { override, imageUrl } = await getCuratedListingData(slug, bobbleheadId);

  return (
    <CuratedBobbleheadPage
      giveaway={giveaway}
      team={team}
      initialOverride={override}
      initialImageUrl={imageUrl}
    />
  );
}

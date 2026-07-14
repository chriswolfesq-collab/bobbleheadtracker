import { notFound } from "next/navigation";
import { getGiveawaysByTeamSlug } from "@/lib/bobbleheads";
import { TEAMS, getTeamBySlug } from "@/lib/teams";
import { TeamPageClient } from "./TeamPageClient";

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

  return (
    <TeamPageClient
      established={establishedBySlug[team.slug] ?? "1901"}
      giveaways={giveaways}
      team={team}
    />
  );
}

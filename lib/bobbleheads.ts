import angels from "@/data/giveaways/angels.json";
import astros from "@/data/giveaways/astros.json";
import athletics from "@/data/giveaways/athletics.json";
import blueJays from "@/data/giveaways/blue-jays.json";
import braves from "@/data/giveaways/braves.json";
import brewers from "@/data/giveaways/brewers.json";
import cardinals from "@/data/giveaways/cardinals.json";
import cubs from "@/data/giveaways/cubs.json";
import diamondbacks from "@/data/giveaways/diamondbacks.json";
import dodgers from "@/data/giveaways/dodgers.json";
import giants from "@/data/giveaways/giants.json";
import guardians from "@/data/giveaways/guardians.json";
import mariners from "@/data/giveaways/mariners.json";
import marlins from "@/data/giveaways/marlins.json";
import mets from "@/data/giveaways/mets.json";
import nationals from "@/data/giveaways/nationals.json";
import orioles from "@/data/giveaways/orioles.json";
import padres from "@/data/giveaways/padres.json";
import phillies from "@/data/giveaways/phillies.json";
import pirates from "@/data/giveaways/pirates.json";
import rangers from "@/data/giveaways/rangers.json";
import rays from "@/data/giveaways/rays.json";
import redSox from "@/data/giveaways/red-sox.json";
import reds from "@/data/giveaways/reds.json";
import rockies from "@/data/giveaways/rockies.json";
import royals from "@/data/giveaways/royals.json";
import tigers from "@/data/giveaways/tigers.json";
import twins from "@/data/giveaways/twins.json";
import whiteSox from "@/data/giveaways/white-sox.json";
import yankees from "@/data/giveaways/yankees.json";

export interface Giveaway {
  id: string;
  title: string;
  /**
   * Optional nickname rendered on a second line beneath the title (e.g. a
   * player's moniker, "La Regadera"). When absent, the title's own trailing
   * parenthetical is auto-split onto the second line instead — see
   * components/BobbleheadTitle.tsx.
   */
  nickname?: string | null;
  year: string;
  date: string;
  imageUrl?: string | null;
}

// The curated giveaway data lives in one JSON file per team under
// data/giveaways/. Edit those files to fix data; this module just assembles
// them under their team slugs (which must match lib/teams.ts).
export const GIVEAWAYS_BY_TEAM: Record<string, Giveaway[]> = {
  "angels": angels,
  "astros": astros,
  "athletics": athletics,
  "blue-jays": blueJays,
  "braves": braves,
  "brewers": brewers,
  "cardinals": cardinals,
  "cubs": cubs,
  "diamondbacks": diamondbacks,
  "dodgers": dodgers,
  "giants": giants,
  "guardians": guardians,
  "mariners": mariners,
  "marlins": marlins,
  "mets": mets,
  "nationals": nationals,
  "orioles": orioles,
  "padres": padres,
  "phillies": phillies,
  "pirates": pirates,
  "rangers": rangers,
  "rays": rays,
  "red-sox": redSox,
  "reds": reds,
  "rockies": rockies,
  "royals": royals,
  "tigers": tigers,
  "twins": twins,
  "white-sox": whiteSox,
  "yankees": yankees,
};

export function getGiveawaysByTeamSlug(slug: string): Giveaway[] {
  return GIVEAWAYS_BY_TEAM[slug] ?? [];
}

export function getGiveawayById(id: string, teamSlug = "dodgers"): Giveaway | undefined {
  return getGiveawaysByTeamSlug(teamSlug).find((giveaway) => giveaway.id === id);
}

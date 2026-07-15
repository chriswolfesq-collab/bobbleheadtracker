export interface Team {
  slug: string;
  name: string;
  city: string;
  abbr: string;
  league: "AL" | "NL";
  division: "East" | "Central" | "West";
  primary: string;
  secondary: string;
  /** position as a percentage of the map container, 0-100 */
  x: number;
  y: number;
  /** which side the hover tooltip should open on to avoid clipping */
  labelSide?: "left" | "right";
}

export const TEAMS: Team[] = [
  // AL East
  { slug: "orioles", name: "Orioles", city: "Baltimore", abbr: "BAL", league: "AL", division: "East", primary: "#DF4601", secondary: "#000000", x: 77.86, y: 46.6, labelSide: "left" },
  { slug: "red-sox", name: "Red Sox", city: "Boston", abbr: "BOS", league: "AL", division: "East", primary: "#BD3039", secondary: "#0C2340", x: 98, y: 34.52, labelSide: "left" },
  { slug: "yankees", name: "Yankees", city: "New York", abbr: "NYY", league: "AL", division: "East", primary: "#132448", secondary: "#C4CED3", x: 87.92, y: 37.61, labelSide: "left" },
  { slug: "rays", name: "Rays", city: "Tampa Bay", abbr: "TB", league: "AL", division: "East", primary: "#092C5C", secondary: "#8FBCE6", x: 78.59, y: 83.99, labelSide: "left" },
  { slug: "blue-jays", name: "Blue Jays", city: "Toronto", abbr: "TOR", league: "AL", division: "East", primary: "#134A8E", secondary: "#1D2D5C", x: 72.82, y: 34.63, labelSide: "left" },

  // AL Central
  { slug: "white-sox", name: "White Sox", city: "Chicago", abbr: "CWS", league: "AL", division: "Central", primary: "#27251F", secondary: "#C4CED3", x: 37.57, y: 45.54, labelSide: "right" },
  { slug: "guardians", name: "Guardians", city: "Cleveland", abbr: "CLE", league: "AL", division: "Central", primary: "#00385D", secondary: "#E31937", x: 62.75, y: 41.96, labelSide: "left" },
  { slug: "tigers", name: "Tigers", city: "Detroit", abbr: "DET", league: "AL", division: "Central", primary: "#0C2340", secondary: "#FA4616", x: 57.72, y: 39.84, labelSide: "right" },
  { slug: "royals", name: "Royals", city: "Kansas City", abbr: "KC", league: "AL", division: "Central", primary: "#004687", secondary: "#BD9B60", x: 27.49, y: 51.89, labelSide: "right" },
  { slug: "twins", name: "Twins", city: "Minneapolis", abbr: "MIN", league: "AL", division: "Central", primary: "#002B5C", secondary: "#D31145", x: 32.53, y: 33.63, labelSide: "right" },

  // AL West
  { slug: "astros", name: "Astros", city: "Houston", abbr: "HOU", league: "AL", division: "West", primary: "#002D62", secondary: "#EB6E1F", x: 53.18, y: 80.46, labelSide: "right" },
  { slug: "angels", name: "Angels", city: "Anaheim", abbr: "LAA", league: "AL", division: "West", primary: "#BA0021", secondary: "#003263", x: 15.36, y: 64.77, labelSide: "right" },
  { slug: "athletics", name: "Athletics", city: "Oakland", abbr: "ATH", league: "AL", division: "West", primary: "#003831", secondary: "#EFB21E", x: 6.94, y: 43.3, labelSide: "right" },
  { slug: "mariners", name: "Mariners", city: "Seattle", abbr: "SEA", league: "AL", division: "West", primary: "#0C2C56", secondary: "#005C5C", x: 10.01, y: 18.26, labelSide: "right" },
  { slug: "rangers", name: "Rangers", city: "Texas", abbr: "TEX", league: "AL", division: "West", primary: "#003278", secondary: "#C0111F", x: 48.15, y: 71.3, labelSide: "right" },

  // NL East
  { slug: "braves", name: "Braves", city: "Atlanta", abbr: "ATL", league: "NL", division: "East", primary: "#CE1141", secondary: "#13274F", x: 73.14, y: 66.07, labelSide: "left" },
  { slug: "marlins", name: "Marlins", city: "Miami", abbr: "MIA", league: "NL", division: "East", primary: "#00A3E0", secondary: "#000000", x: 84.32, y: 88.93, labelSide: "left" },
  { slug: "mets", name: "Mets", city: "New York", abbr: "NYM", league: "NL", division: "East", primary: "#002D72", secondary: "#FF5910", x: 97.97, y: 43.78, labelSide: "left" },
  { slug: "phillies", name: "Phillies", city: "Philadelphia", abbr: "PHI", league: "NL", division: "East", primary: "#E81828", secondary: "#002D72", x: 92.94, y: 44.02, labelSide: "left" },
  { slug: "nationals", name: "Nationals", city: "Washington D.C.", abbr: "WSH", league: "NL", division: "East", primary: "#AB0003", secondary: "#14225A", x: 82.89, y: 48.02, labelSide: "left" },

  // NL Central
  { slug: "cubs", name: "Cubs", city: "Chicago", abbr: "CHC", league: "NL", division: "Central", primary: "#0E3386", secondary: "#CC3433", x: 47.64, y: 39.19, labelSide: "right" },
  { slug: "reds", name: "Reds", city: "Cincinnati", abbr: "CIN", league: "NL", division: "Central", primary: "#C6011F", secondary: "#000000", x: 52.68, y: 50.13, labelSide: "left" },
  { slug: "brewers", name: "Brewers", city: "Milwaukee", abbr: "MIL", league: "NL", division: "Central", primary: "#12284B", secondary: "#FFC52F", x: 42.6, y: 38.94, labelSide: "right" },
  { slug: "pirates", name: "Pirates", city: "Pittsburgh", abbr: "PIT", league: "NL", division: "Central", primary: "#FDB827", secondary: "#000000", x: 67.79, y: 44.54, labelSide: "left" },
  { slug: "cardinals", name: "Cardinals", city: "St. Louis", abbr: "STL", league: "NL", division: "Central", primary: "#C41E3A", secondary: "#0C2340", x: 32.53, y: 52.82, labelSide: "right" },

  // NL West
  { slug: "diamondbacks", name: "Diamondbacks", city: "Phoenix", abbr: "AZ", league: "NL", division: "West", primary: "#A71930", secondary: "#E3D4AD", x: 20.45, y: 65.91, labelSide: "right" },
  { slug: "rockies", name: "Rockies", city: "Denver", abbr: "COL", league: "NL", division: "West", primary: "#333366", secondary: "#C4CED4", x: 22.44, y: 48.61, labelSide: "right" },
  { slug: "dodgers", name: "Dodgers", city: "Los Angeles", abbr: "LAD", league: "NL", division: "West", primary: "#005A9C", secondary: "#FFFFFF", x: 4.98, y: 60.3, labelSide: "right" },
  { slug: "padres", name: "Padres", city: "San Diego", abbr: "SD", league: "NL", division: "West", primary: "#2F241D", secondary: "#FFC425", x: 10.28, y: 65.46, labelSide: "right" },
  { slug: "giants", name: "Giants", city: "San Francisco", abbr: "SF", league: "NL", division: "West", primary: "#FD5A1E", secondary: "#27251F", x: 2, y: 49.15, labelSide: "right" },
];

export function getTeamBySlug(slug: string): Team | undefined {
  return TEAMS.find((t) => t.slug === slug);
}

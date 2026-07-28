import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BobbleShelf",
    short_name: "BobbleShelf",
    description:
      "The most comprehensive database of MLB stadium giveaway bobbleheads. Track your collection.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0e8dc",
    theme_color: "#1e3a5f",
    icons: [
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

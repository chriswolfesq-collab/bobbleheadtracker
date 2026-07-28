import { Inter, Oswald, Pacifico } from "next/font/google";

// Body face. Variable font — no weight needed.
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Condensed display face for the wordmark, headlines, and uppercase labels.
export const oswald = Oswald({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-oswald",
});

// Script accent used only for the city name on team heroes; not worth
// preloading on every route.
export const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-pacifico",
});

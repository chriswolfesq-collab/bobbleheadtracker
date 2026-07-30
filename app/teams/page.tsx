import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { TeamsPageClient } from "./TeamsPageClient";

const title = "All Teams — BobbleShelf";
const description =
  "Browse all 30 MLB teams and their stadium giveaway bobbleheads, shelf by shelf, division by division.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/teams" },
  openGraph: { title, description, type: "website", url: "/teams" },
};

export default function TeamsPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: "Teams", path: "/teams" }]} />
      <TeamsPageClient />
    </>
  );
}

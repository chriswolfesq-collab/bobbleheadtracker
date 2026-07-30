import type { Metadata } from "next";
import { siteUrl } from "@/lib/siteUrl";
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
  const base = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "BobbleShelf", item: base },
      { "@type": "ListItem", position: 2, name: "Teams", item: `${base}/teams` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TeamsPageClient />
    </>
  );
}

import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { RecentlyAddedPageClient } from "./RecentlyAddedPageClient";

const title = "Recently Added Bobbleheads — BobbleShelf";
const description =
  "The latest MLB stadium giveaway bobbleheads added by the collector community.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/recently-added" },
  openGraph: { title, description, type: "website", url: "/recently-added" },
};

export default function RecentlyAddedPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: "Recently Added", path: "/recently-added" }]} />
      <RecentlyAddedPageClient />
    </>
  );
}

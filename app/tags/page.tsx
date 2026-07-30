import type { Metadata } from "next";
import { TagsPageClient } from "./TagsPageClient";

export const metadata: Metadata = {
  title: "Tags — BobbleShelf",
  description:
    "Browse MLB stadium giveaway bobbleheads by theme — Star Wars, Sugar Skull, Peanuts and more, across every team.",
  alternates: { canonical: "/tags" },
};

export default function TagsPage() {
  return <TagsPageClient />;
}

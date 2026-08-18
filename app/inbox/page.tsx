import type { Metadata } from "next";
import { InboxPageClient } from "./InboxPageClient";

export const metadata: Metadata = {
  title: "Inbox — BobbleShelf",
  description: "Your messages on BobbleShelf.",
  // Nobody's mail belongs in a search index, same as /settings.
  robots: { index: false },
};

export default function InboxPage() {
  return <InboxPageClient />;
}

import type { Metadata } from "next";
import { ProfilePageClient } from "./ProfilePageClient";

export const metadata: Metadata = {
  title: "My Profile — BobbleShelf",
  description: "Your bobblehead collection, favorites, wanted list, and submissions.",
  robots: { index: false },
};

export default function ProfilePage() {
  return <ProfilePageClient />;
}

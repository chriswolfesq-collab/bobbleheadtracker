import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ProfileShell } from "./ProfileShell";

// Inherited by every tab page below; each page only overrides the title.
export const metadata: Metadata = {
  title: "My Profile — BobbleShelf",
  description: "Your bobblehead collection, favorites, wanted list, and submissions.",
  robots: { index: false },
};

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}

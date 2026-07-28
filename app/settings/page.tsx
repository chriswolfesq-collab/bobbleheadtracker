import type { Metadata } from "next";
import { SettingsPageClient } from "./SettingsPageClient";

export const metadata: Metadata = {
  title: "Settings — BobbleShelf",
  description: "Manage shelf sharing, gallery, and email alert preferences.",
  robots: { index: false },
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}

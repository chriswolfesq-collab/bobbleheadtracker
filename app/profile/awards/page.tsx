import type { Metadata } from "next";
import { AwardsTab } from "../tabs";

export const metadata: Metadata = {
  title: "My Awards — BobbleShelf",
};

export default function ProfileAwardsPage() {
  return <AwardsTab />;
}

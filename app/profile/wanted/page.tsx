import type { Metadata } from "next";
import { WantedTab } from "../tabs";

export const metadata: Metadata = {
  title: "My Wanted List — BobbleShelf",
};

export default function ProfileWantedPage() {
  return <WantedTab />;
}

import type { Metadata } from "next";
import { ReferTab } from "../tabs";

export const metadata: Metadata = {
  title: "Refer a Friend — BobbleShelf",
};

export default function ProfileReferPage() {
  return <ReferTab />;
}

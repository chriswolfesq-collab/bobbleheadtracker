import type { Metadata } from "next";
import { FriendsTab } from "../tabs";

export const metadata: Metadata = {
  title: "My Friends — BobbleShelf",
};

export default function ProfileFriendsPage() {
  return <FriendsTab />;
}

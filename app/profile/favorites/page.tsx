import type { Metadata } from "next";
import { FavoritesTab } from "../tabs";

export const metadata: Metadata = {
  title: "My Favorites — BobbleShelf",
};

export default function ProfileFavoritesPage() {
  return <FavoritesTab />;
}

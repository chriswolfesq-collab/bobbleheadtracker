import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPageClient } from "./SearchPageClient";

export const metadata: Metadata = {
  title: "Search — BobbleShelf",
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageClient />
    </Suspense>
  );
}

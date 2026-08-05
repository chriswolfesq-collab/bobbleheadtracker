import type { Metadata } from "next";
import { TagPageClient } from "./TagPageClient";

// No generateStaticParams: the vocabulary lives in the database and grows
// whenever a rep labels something, so there's no build-time list of slugs to
// prerender. The page renders for any slug and says so when nothing matches.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // The label is a database read the client does anyway; using the slug here
  // keeps metadata generation off the database for a page whose body is
  // client-rendered regardless. Title-cased, because a slug is lowercase and a
  // browser tab reading "legends bobbleheads" looks like a bug next to every
  // other page's title.
  const readable = slug.replace(/-/g, " ");
  const titleCased = readable.replace(/\b\p{Ll}/gu, (letter) => letter.toUpperCase());

  return {
    title: `${titleCased} Bobbleheads — BobbleShelf`,
    description: `Every MLB stadium giveaway bobblehead tagged ${readable}, across all 30 teams.`,
    alternates: { canonical: `/tags/${slug}` },
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <TagPageClient slug={slug} />;
}

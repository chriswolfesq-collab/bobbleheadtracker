import Link from "next/link";

// Scoped to /shelf/<slug> rather than using the site-wide 404, because this one
// has a specific visitor: someone who followed a shared link that no longer
// resolves — a slug that never existed, or a shelf whose owner has since gone
// private. They came here to look at a collection, so the ask is the same as on
// a live shelf even though there's nothing to show them.
//
// The copy deliberately doesn't say which of the two happened. Saying "this
// collector went private" would confirm the account exists, which is exactly
// what get_public_shelf refuses to reveal.
export default function ShelfNotFound() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-24 text-center"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80">
        MLB Bobblehead Shelf
      </p>
      <h1 className="mt-3 text-2xl font-black text-white">This shelf isn&apos;t here</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        The link may be wrong, or its owner has made their shelf private.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-amber-400 px-6 py-3 text-xs font-black uppercase tracking-wide text-[#0e1626] transition hover:bg-amber-300"
      >
        Build your shelf
      </Link>
    </div>
  );
}

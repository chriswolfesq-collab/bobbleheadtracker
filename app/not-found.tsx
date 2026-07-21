import Link from "next/link";

// Site-wide 404: rendered both for URLs that match no route (e.g. a mistyped
// team slug) and for any `notFound()` call without a closer not-found boundary.
// Without this the framework's bare "404 – This page could not be found" shows,
// stranding the visitor with no branding and no way back into the app.
export default function NotFound() {
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
      <h1 className="mt-3 text-2xl font-black text-white">This page isn&apos;t here</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        The link may be wrong, or the page may have moved. Let&apos;s get you back to the shelf.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-amber-400 px-6 py-3 text-xs font-black uppercase tracking-wide text-[#0e1626] transition hover:bg-amber-300"
      >
        Back to the shelf
      </Link>
    </div>
  );
}

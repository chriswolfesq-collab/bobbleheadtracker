import Link from "next/link";
import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import DisplayCase from "@/components/DisplayCase";
import { HomeWelcomeModal } from "@/components/HomeWelcomeModal";
import RecentlyAdded from "@/components/RecentlyAdded";
import { SiteSearch } from "@/components/SiteSearch";

export default function Home() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <HomeWelcomeModal />

      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <SiteSearch variant="inline" />
        <div className="flex items-center gap-3">
          <AdminModeBadge />
          <AuthWidget />
        </div>
      </div>

      <header className="px-4 pb-8 pt-6 text-center sm:pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
          Click your team. Track your collection.
        </p>
      </header>

      <DisplayCase />

      <div className="mt-6">
        <RecentlyAdded />
      </div>

      <footer className="mt-6 px-4 pb-6 text-center">
        <Link
          href="/terms"
          className="text-[11px] font-medium text-slate-500 underline decoration-slate-400 underline-offset-2 hover:text-slate-700 dark:decoration-slate-700 dark:hover:text-slate-300"
        >
          Terms of Service
        </Link>
      </footer>

      <div className="h-16" />
    </div>
  );
}

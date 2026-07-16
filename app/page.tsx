import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import DisplayCase from "@/components/DisplayCase";

export default function Home() {
  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -10%, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
      }}
    >
      <div className="flex items-center justify-end gap-3 px-4 pt-4 sm:px-6">
        <AdminModeBadge />
        <AuthWidget />
      </div>

      <header className="px-4 pb-8 pt-6 text-center sm:pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-500/80 sm:text-xs">
          Click your team. Track your collection.
        </p>
      </header>

      <DisplayCase />

      <div className="h-16" />
    </div>
  );
}

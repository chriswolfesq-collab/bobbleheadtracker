"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/adminAuth";

export function AdminModeBadge({ className }: { className?: string }) {
  const { isAdmin, isRep } = useAdminAuth();

  if (!isAdmin && !isRep) return null;

  const label = isAdmin ? "Admin mode" : "Team rep";

  return (
    <Link
      href="/admin"
      aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg ${className ?? ""}`}
    >
      <span aria-hidden>⚙</span>
      {/* The label alone is ~85px — too much next to the search and account
          controls on a phone, so below `sm` the gear carries it. */}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { NotificationBadge } from "@/components/NotificationBadge";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAdminQueueCounts } from "@/lib/useAdminQueueCounts";

export function AdminModeBadge({ className }: { className?: string }) {
  const { isAdmin, isRep } = useAdminAuth();
  // Everything waiting across the tools this account can use. The dashboard
  // says which queue; the point here is only "there's something to look at",
  // since this button is the one bit of the console on every page.
  const { total } = useAdminQueueCounts();

  if (!isAdmin && !isRep) return null;

  const label = isAdmin ? "Admin mode" : "Team rep";
  // The number is decoration for a screen reader — on its own it says nothing —
  // so it's announced here as part of the link instead.
  const description =
    total > 0 ? `${label} — ${total} ${total === 1 ? "item" : "items"} waiting` : label;

  return (
    <Link
      href="/admin"
      aria-label={description}
      className={`relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg ${className ?? ""}`}
    >
      <span aria-hidden>⚙</span>
      {/* The label alone is ~85px — too much next to the search and account
          controls on a phone, so below `sm` the gear carries it. */}
      <span className="hidden sm:inline">{label}</span>
      {/* Tucked in tighter than the dashboard's tiles use: this button has the
          account controls a hair to its right, and the header's own background
          is what the ring has to blend into. */}
      <NotificationBadge
        count={total}
        offsetClass="-right-1.5 -top-1.5"
        ringClass="ring-background"
        aria-hidden
      />
    </Link>
  );
}

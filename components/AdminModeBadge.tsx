"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/adminAuth";

export function AdminModeBadge({ className }: { className?: string }) {
  const { isAdmin, isRep } = useAdminAuth();

  if (!isAdmin && !isRep) return null;

  return (
    <Link
      href="/admin"
      className={`inline-flex items-center gap-1.5 rounded border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg ${className ?? ""}`}
    >
      <span aria-hidden>⚙</span>
      {isAdmin ? "Admin mode" : "Team rep"}
    </Link>
  );
}

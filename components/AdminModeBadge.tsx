"use client";

import Link from "next/link";
import { useAdminAuth } from "@/lib/adminAuth";

export function AdminModeBadge({ className }: { className?: string }) {
  const { isAdmin } = useAdminAuth();

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      className={`inline-flex items-center gap-1.5 rounded border border-amber-400/60 bg-amber-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d] ${className ?? ""}`}
    >
      <span aria-hidden>⚙</span>
      Admin mode
    </Link>
  );
}

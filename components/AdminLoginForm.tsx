"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";

export function AdminLoginForm() {
  const { signIn, signUp } = useAdminAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (confirmationSent) {
    return (
      <div className="mx-auto mt-10 max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 text-center shadow-2xl shadow-black/50">
          <p className="text-sm leading-6 text-zinc-200">
            Check your email to confirm the account, then sign in here. It still needs to be approved for admin
            access separately.
          </p>
        </div>
        <Link
          href="/"
          className="mt-4 block text-center text-xs font-bold text-amber-300 hover:text-amber-200"
        >
          ← Back to Bobble Shelf
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <form
        className="grid gap-3 rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setIsSubmitting(true);

          const result = mode === "sign-in" ? await signIn(email, password) : await signUp(email, password);

          setIsSubmitting(false);

          if (result.error) {
            setError(result.error);
            return;
          }

          if (mode === "sign-up") {
            setConfirmationSent(true);
          }
        }}
      >
        <div className="mb-1 text-center">
          <h1 className="text-lg font-black text-white">Admin login</h1>
          <p className="mt-1 text-xs text-zinc-400">
            {mode === "sign-in"
              ? "Sign in with an approved admin account."
              : "Create admin credentials, then ask the site owner to approve the email."}
          </p>
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-bold text-zinc-300">Email address</label>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email address"
            className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-xs font-bold text-zinc-300">Password</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
          />
        </div>

        {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
        >
          {isSubmitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
          className="text-center text-xs font-bold text-amber-300 hover:text-amber-200"
        >
          {mode === "sign-in" ? "Need admin credentials? Sign up" : "Already have credentials? Sign in"}
        </button>
      </form>
      <Link href="/" className="mt-4 block text-center text-xs font-bold text-amber-300 hover:text-amber-200">
        ← Back to Bobble Shelf
      </Link>
    </div>
  );
}

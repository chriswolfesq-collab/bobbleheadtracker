"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function AuthWidget({ className }: { className?: string }) {
  const { user, isLoading, signIn, signUp, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (isLoading) {
    return null;
  }

  if (user) {
    return (
      <div className={`flex items-center gap-3 text-sm ${className ?? ""}`}>
        <span className="font-semibold text-zinc-200">{user.email}</span>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded border border-white/20 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-300"
        >
          Log out
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`rounded border border-amber-400 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-300 transition hover:bg-amber-400 hover:text-[#07111d] ${className ?? ""}`}
      >
        Log in
      </button>
    );
  }

  return (
    <form
      className={`grid gap-2 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm ${className ?? ""}`}
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
          return;
        }

        setIsOpen(false);
        setEmail("");
        setPassword("");
      }}
    >
      {confirmationSent ? (
        <p className="text-xs leading-5 text-zinc-200">
          Check your email to confirm your account, then log in.
        </p>
      ) : (
        <>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
          />
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="w-full rounded border border-white/15 bg-[#07111d] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
          />
          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              className="text-xs font-bold uppercase tracking-wide text-zinc-300 hover:text-amber-300"
            >
              {mode === "sign-in" ? "Need an account?" : "Have an account?"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded border border-white/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded bg-amber-500 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
              >
                {mode === "sign-in" ? "Log in" : "Sign up"}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

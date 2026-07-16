"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (!isAuthModalOpen) {
    return null;
  }

  const mode = authModalMode;

  const resetAndClose = () => {
    closeAuthModal();
    setDisplayName("");
    setEmail("");
    setPassword("");
    setAcceptedTerms(false);
    setError(null);
    setConfirmationSent(false);
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    const result = provider === "google" ? await signInWithGoogle() : await signInWithGithub();
    setOauthLoading(null);
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        {confirmationSent ? (
          <div className="grid gap-4 text-center">
            <p className="text-sm leading-6 text-zinc-200">
              Check your email to confirm your account, then log in.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mx-auto rounded border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-300"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-[#07111d]">
                🏆
              </div>
              <div>
                <h2 className="text-lg font-black text-white">
                  {mode === "sign-in" ? "Sign in" : "Create your account"}
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  {mode === "sign-in"
                    ? "Welcome back! Please sign in to continue."
                    : "Welcome! Please fill in the details to get started."}
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={oauthLoading !== null}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-100 transition hover:border-amber-400/60 hover:bg-white/10 disabled:opacity-60"
              >
                <GoogleIcon />
                {oauthLoading === "google" ? "Connecting…" : "Continue with Google"}
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("github")}
                disabled={oauthLoading !== null}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-100 transition hover:border-amber-400/60 hover:bg-white/10 disabled:opacity-60"
              >
                <GithubIcon />
                {oauthLoading === "github" ? "Connecting…" : "Continue with GitHub"}
              </button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form
              className="grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();

                if (mode === "sign-up" && !displayName.trim()) {
                  setError("Please enter a name.");
                  return;
                }

                if (mode === "sign-up" && !acceptedTerms) {
                  setError("Please accept the Terms of Service to continue.");
                  return;
                }

                setError(null);
                setIsSubmitting(true);

                const result =
                  mode === "sign-in"
                    ? await signIn(email, password)
                    : await signUp(email, password, displayName.trim());

                setIsSubmitting(false);

                if (result.error) {
                  setError(result.error);
                  return;
                }

                if (mode === "sign-up") {
                  setConfirmationSent(true);
                  return;
                }

                resetAndClose();
              }}
            >
              {mode === "sign-up" ? (
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-zinc-300">Your name</label>
                  <input
                    required
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
                  />
                </div>
              ) : null}
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
              {mode === "sign-up" ? (
                <label className="flex items-start gap-2 text-xs text-zinc-300">
                  <input
                    required
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-white/30 bg-[#07111d] accent-amber-400"
                  />
                  <span>
                    I accept the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-amber-300 hover:text-amber-200"
                    >
                      Terms of Service
                    </Link>
                  </span>
                </label>
              ) : null}
              {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
              >
                {isSubmitting ? "Please wait…" : "Continue"}
              </button>
            </form>

            <div className="mt-5 border-t border-white/10 pt-4 text-center text-xs text-zinc-400">
              {mode === "sign-in" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  openAuthModal(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
                className="font-bold text-amber-300 hover:text-amber-200"
              >
                {mode === "sign-in" ? "Sign up" : "Sign in"}
              </button>
            </div>

            <button
              type="button"
              onClick={resetAndClose}
              className="mt-3 w-full text-center text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.4 0-13.8 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2.1 1.5-4.8 2.5-7.5 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5C10.1 39.8 16.5 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.5 5.5C40.9 36.5 44 30.8 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

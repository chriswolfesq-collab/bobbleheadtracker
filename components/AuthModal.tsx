"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { MAX_DISPLAY_NAME_LENGTH, useAuth, validateDisplayName } from "@/lib/auth";
import { sendPasswordReset } from "@/lib/passwordReset";
import { captchaEnabled } from "@/lib/turnstile";
import { useDialog } from "@/lib/useDialog";

export function AuthModal() {
  const {
    isAuthModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    signIn,
    signUp,
    signInWithGoogle,
    oauthError,
    clearOauthError,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  // "I forgot my password" is a detour off the sign-in form rather than a third
  // authModalMode: nothing outside this component ever needs to open straight
  // into it, so it stays local like confirmationSent.
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Null until the challenge passes, and again the moment it's spent or expires.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped after a failed attempt to trade the consumed token for a fresh one.
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);

  const resetAndClose = useCallback(() => {
    closeAuthModal();
    setDisplayName("");
    setEmail("");
    setPassword("");
    setAcceptedTerms(false);
    setError(null);
    setConfirmationSent(false);
    setIsForgotMode(false);
    setResetSent(false);
    setCaptchaToken(null);
    setCaptchaUnavailable(false);
  }, [closeAuthModal]);

  // Escape/focus-trap/restore. Called before the early return so the hook order
  // stays stable whether or not the modal is open.
  const panelRef = useDialog<HTMLDivElement>(isAuthModalOpen, resetAndClose);

  if (!isAuthModalOpen) {
    return null;
  }

  const mode = authModalMode;
  // A failed OAuth redirect surfaces its reason through context; a form attempt
  // sets the local error. Either one should show in the same spot.
  const displayError = error ?? oauthError;

  // With no site key configured this is always false and nothing below changes.
  const awaitingCaptcha = captchaEnabled && !captchaToken;

  // Crossing between the sign-in and forgot-password forms unmounts one widget
  // and mounts another, so the old instance's token is dropped and the new
  // instance issues its own. Safe only across that boundary — see the note on
  // the sign-in/sign-up toggle, which does not remount.
  const forgetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaUnavailable(false);
  };

  // Turnstile tokens are single-use. A rejected attempt has already spent this
  // one, so the challenge has to be re-run before a retry can succeed.
  const retireSpentCaptcha = () => setCaptchaResetSignal((signal) => signal + 1);

  const captchaField = captchaEnabled ? (
    <div className="grid gap-1.5">
      <TurnstileWidget
        onToken={setCaptchaToken}
        onUnavailable={() => setCaptchaUnavailable(true)}
        resetSignal={captchaResetSignal}
      />
      {captchaUnavailable ? (
        <p className="text-xs font-semibold text-red-400">
          Couldn&rsquo;t load the bot check. If you use an ad blocker, allow
          challenges.cloudflare.com and reload the page.
        </p>
      ) : null}
    </div>
  ) : null;

  const handleOAuth = async () => {
    setError(null);
    clearOauthError();
    setOauthLoading(true);
    const result = await signInWithGoogle();
    setOauthLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    setError(null);
    clearOauthError();
    setIsSubmitting(true);

    const result = await sendPasswordReset(email.trim(), captchaToken ?? undefined);

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      retireSpentCaptcha();
      return;
    }

    setResetSent(true);
  };

  const leaveForgotMode = () => {
    setError(null);
    clearOauthError();
    setIsForgotMode(false);
    forgetCaptcha();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={resetAndClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={
          isForgotMode
            ? "Reset your password"
            : mode === "sign-in"
              ? "Sign in"
              : "Create your account"
        }
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        {confirmationSent ? (
          <div className="grid gap-4 text-center">
            <p className="text-sm leading-6 text-zinc-800">
              Check your email to confirm your account, then log in.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mx-auto rounded border border-black/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-700"
            >
              Close
            </button>
          </div>
        ) : resetSent ? (
          <div className="grid gap-4 text-center">
            <h2 className="text-lg font-black text-zinc-900">Check your email</h2>
            {/* Deliberately conditional. Supabase reports success whether or not
                the address has an account, and saying "we sent it" outright
                would turn this form into a way to find out who's registered. */}
            <p className="text-sm leading-6 text-zinc-800">
              If there&rsquo;s an account for <strong>{email.trim()}</strong>, a link to choose a
              new password is on its way. It works once, and expires.
            </p>
            <button
              type="button"
              onClick={resetAndClose}
              className="mx-auto rounded border border-black/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-700"
            >
              Close
            </button>
          </div>
        ) : isForgotMode ? (
          <>
            <div className="mb-5 text-center">
              <h2 className="text-lg font-black text-zinc-900">Reset your password</h2>
              <p className="mt-1 text-xs text-zinc-600">
                Enter the email you signed up with and we&rsquo;ll send a link to set a new
                password.
              </p>
            </div>

            <form className="grid gap-3" onSubmit={handleForgotPassword}>
              <div className="grid gap-1.5">
                <label htmlFor="forgot-email" className="text-xs font-bold text-zinc-700">
                  Email address
                </label>
                <input
                  autoFocus
                  required
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
                />
              </div>

              {captchaField}

              {displayError ? (
                <p className="text-xs font-semibold text-red-400">{displayError}</p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || awaitingCaptcha}
                className="mt-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
              >
                {isSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <button
              type="button"
              onClick={leaveForgotMode}
              className="mt-5 w-full border-t border-black/10 pt-4 text-center text-xs font-bold text-accent hover:text-accent-hover"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-lg font-black text-accent-fg">
                🏆
              </div>
              <div>
                <h2 className="text-lg font-black text-zinc-900">
                  {mode === "sign-in" ? "Sign in" : "Create your account"}
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  {mode === "sign-in"
                    ? "Welcome back! Please sign in to continue."
                    : "Welcome! Please fill in the details to get started."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOAuth}
              disabled={oauthLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-black/[0.04] px-3 py-2.5 text-sm font-bold text-zinc-900 transition hover:border-accent/60 hover:bg-black/[0.06] disabled:opacity-60"
            >
              <GoogleIcon />
              {oauthLoading ? "Connecting…" : "Continue with Google"}
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            <form
              className="grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();

                if (mode === "sign-up") {
                  const invalid = validateDisplayName(displayName);
                  if (invalid) {
                    setError(invalid);
                    return;
                  }
                }

                if (mode === "sign-up" && !acceptedTerms) {
                  setError("Please accept the Terms of Service to continue.");
                  return;
                }

                setError(null);
                clearOauthError();
                setIsSubmitting(true);

                const token = captchaToken ?? undefined;
                const result =
                  mode === "sign-in"
                    ? await signIn(email, password, token)
                    : await signUp(email, password, displayName.trim(), token);

                setIsSubmitting(false);

                if (result.error) {
                  setError(result.error);
                  retireSpentCaptcha();
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
                  <label className="text-xs font-bold text-zinc-700">Your name</label>
                  <input
                    required
                    type="text"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Enter your name"
                    className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <label className="text-xs font-bold text-zinc-700">Email address</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label className="text-xs font-bold text-zinc-700">Password</label>
                  {/* Sign-in only: on the sign-up form there's no password to
                      have forgotten yet. */}
                  {mode === "sign-in" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        clearOauthError();
                        setIsForgotMode(true);
                        forgetCaptcha();
                      }}
                      className="text-xs font-bold text-accent hover:text-accent-hover"
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </div>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent"
                />
              </div>
              {mode === "sign-up" ? (
                <label className="flex items-start gap-2 text-xs text-zinc-700">
                  <input
                    required
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-black/20 bg-white accent-accent"
                  />
                  <span>
                    I accept the{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-accent hover:text-accent-hover"
                    >
                      Terms of Service
                    </Link>
                  </span>
                </label>
              ) : null}
              {captchaField}
              {displayError ? <p className="text-xs font-semibold text-red-400">{displayError}</p> : null}
              <button
                type="submit"
                disabled={isSubmitting || awaitingCaptcha}
                className="mt-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
              >
                {isSubmitting ? "Please wait…" : "Continue"}
              </button>
            </form>

            <div className="mt-5 border-t border-black/10 pt-4 text-center text-xs text-zinc-600">
              {mode === "sign-in" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                // No captcha reset here on purpose: sign-in and sign-up share
                // one <form>, so the widget stays mounted and would never fire
                // its callback again. The token is unspent and still good.
                onClick={() => {
                  setError(null);
                  clearOauthError();
                  openAuthModal(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
                className="font-bold text-accent hover:text-accent-hover"
              >
                {mode === "sign-in" ? "Sign up" : "Sign in"}
              </button>
            </div>

            <button
              type="button"
              onClick={resetAndClose}
              className="mt-3 w-full text-center text-xs font-bold uppercase tracking-wide text-zinc-500 hover:text-zinc-700"
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

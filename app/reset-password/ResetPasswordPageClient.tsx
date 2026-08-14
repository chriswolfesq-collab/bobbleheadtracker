"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { authErrorMessage } from "@/lib/authErrors";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/passwordReset";
import { supabase } from "@/lib/supabase";

// "checking" lasts only as long as it takes the shared client to finish reading
// the recovery token out of the URL; getSession() waits on that initialization,
// so by the time it resolves the answer is final.
type Status = "checking" | "ready" | "expired" | "done";

const inputClass =
  "w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-500 focus:border-accent";

export function ResetPasswordPageClient() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // A valid recovery link arrives as a URL hash that auth-js exchanges for a
    // real (if short-lived) session before getSession() resolves. So "is there
    // a session?" is the whole check — no need to listen for PASSWORD_RECOVERY
    // and race the page's own mount. Someone already signed in who lands here
    // without a link passes too, which is correct: changing your own password
    // while signed in is the same operation.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus(data.session ? "ready" : "expired");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalid = validateNewPassword(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (updateError) {
      setError(authErrorMessage(updateError));
      return;
    }

    // The recovery session becomes an ordinary one on success, so they're
    // already signed in — there's nothing left to do but let them go use the
    // site. Clearing the fields keeps the new password off the screen.
    setPassword("");
    setConfirmation("");
    setStatus("done");
  };

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Reset password" }]} />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-24 pt-6">
        {status === "checking" ? null : status === "done" ? (
          <div className="grid gap-4 rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-black text-zinc-900">Password updated</h1>
            <p className="text-sm text-zinc-600">
              You&rsquo;re signed in with your new password. Use it next time you log in.
            </p>
            <Link
              href="/"
              className="rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover"
            >
              Go to my shelf
            </Link>
          </div>
        ) : status === "expired" ? (
          <div className="grid gap-4 rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-black text-zinc-900">This link has expired</h1>
            <p className="text-sm text-zinc-600">
              Password reset links work once and time out after a while. Ask for a fresh one and
              open it from the newest email.
            </p>
            <Link
              href="/contact"
              className="rounded-lg border border-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg"
            >
              Request a new link
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
          >
            <div className="text-center">
              <h1 className="text-lg font-black text-zinc-900">Choose a new password</h1>
              <p className="mt-1 text-xs text-zinc-600">
                Pick something at least {MIN_PASSWORD_LENGTH} characters long.
              </p>
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="new-password" className="text-xs font-bold text-zinc-700">
                New password
              </label>
              <input
                autoFocus
                required
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter a new password"
                className={inputClass}
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="confirm-password" className="text-xs font-bold text-zinc-700">
                Confirm new password
              </label>
              <input
                required
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Type it again"
                className={inputClass}
              />
            </div>

            {error ? <p className="text-xs font-semibold text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

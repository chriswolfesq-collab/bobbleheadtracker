"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { submitListingReport, type ReportReason } from "@/lib/reports";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "not_real", label: "Not a real listing" },
  { value: "wrong_date", label: "Incorrect date" },
  { value: "wrong_name", label: "Incorrect name" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "other", label: "Other" },
];

// The caller only mounts this while open, so a fresh instance is guaranteed
// every time it's opened, same as EditBobbleheadDialog.
function ReportListingDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: ReportReason, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason>("not_real");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={close}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white">Report this listing</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Tell the admin what&apos;s wrong. Reports are reviewed before anything changes.
        </p>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);

            if (reason === "other" && !details.trim()) {
              setError("Add a short explanation.");
              return;
            }

            setIsSubmitting(true);
            try {
              await onSubmit(reason, details.trim());
              onClose();
            } catch (submitError) {
              setError(submitError instanceof Error ? submitError.message : "Could not submit report.");
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-300">What&apos;s wrong?</label>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value as ReportReason)}
              className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Details {reason === "other" ? "" : "(optional)"}
            </label>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              placeholder="Anything that helps the admin fix it"
              className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
            />
          </div>

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send report"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-amber-400/60 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReportListingButton({
  teamSlug,
  bobbleheadId,
  source,
  title,
  className,
}: {
  teamSlug: string;
  bobbleheadId: string;
  source: "curated" | "community";
  title: string;
  className: string;
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (isSubmitted) {
    return (
      <span className={className}>
        <span className="text-xs font-black uppercase tracking-wide text-amber-300">Report sent — thanks</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          if (!user) {
            setMessage("Log in to report a listing.");
            return;
          }
          setMessage(null);
          setIsOpen(true);
        }}
      >
        {message ? <span className="text-red-300">{message}</span> : "Report an issue with this listing"}
      </button>

      {isOpen && user ? (
        <ReportListingDialog
          onClose={() => setIsOpen(false)}
          onSubmit={async (reason, details) => {
            await submitListingReport({ user, teamSlug, bobbleheadId, source, title, reason, details });
            setIsSubmitted(true);
          }}
        />
      ) : null}
    </>
  );
}

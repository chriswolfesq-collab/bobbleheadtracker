"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { submitPhotoForExisting } from "@/lib/submissions";

type Status = "idle" | "uploading" | "submitted" | "error";

export function SubmitPhotoButton({
  bobbleheadId,
  teamSlug,
  className,
  children,
  label,
}: {
  bobbleheadId: string;
  teamSlug: string;
  className: string;
  children?: ReactNode;
  label: string;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (status === "submitted") {
    return (
      <div className={className}>
        <span className="text-center text-xs font-black uppercase tracking-wide text-amber-300">
          Submitted — pending review
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => setMessage("Log in to submit a photo for review.")}
      >
        {message ? (
          <span className="text-center text-xs font-semibold text-amber-300">{message}</span>
        ) : (
          (children ?? label)
        )}
      </button>
    );
  }

  return (
    <label className={className}>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={status === "uploading"}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;

          setStatus("uploading");
          setMessage(null);

          try {
            await submitPhotoForExisting({ user, teamSlug, bobbleheadId, file });
            setStatus("submitted");
          } catch (error) {
            setStatus("idle");
            setMessage(error instanceof Error ? error.message : "Could not submit photo.");
          }
        }}
      />
      {status === "uploading" ? (
        <span className="text-xs font-black uppercase tracking-wide text-zinc-400">Uploading…</span>
      ) : message ? (
        <span className="text-center text-xs font-semibold text-red-400">{message}</span>
      ) : (
        (children ?? label)
      )}
    </label>
  );
}

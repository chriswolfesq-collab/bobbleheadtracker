"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { submitPhotoForExisting } from "@/lib/submissions";

type Status = "idle" | "uploading" | "submitted" | "error";

// The caller's className styles an interactive control. Once the submission is
// done the element is just a label, so drop the classes that still advertise a
// click — the pointer cursor and any hover state.
function inertClassName(className: string) {
  return className
    .split(/\s+/)
    .filter((token) => token !== "cursor-pointer" && !token.startsWith("hover:"))
    .join(" ");
}

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
  const [autoApproved, setAutoApproved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Status text never sets its own color: `className` comes from the caller and
  // already pairs a background with a legible foreground (a solid accent button
  // in one place, plain accent-on-surface in another). Hardcoding a color here
  // painted navy on navy.
  if (status === "submitted") {
    return (
      <div className={inertClassName(className)}>
        <span className="text-center text-xs font-black uppercase tracking-wide">
          {autoApproved ? "Added — live now" : "Submitted — pending review"}
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
          <span className="text-center text-xs font-semibold">{message}</span>
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
            const result = await submitPhotoForExisting({ user, teamSlug, bobbleheadId, file });
            setAutoApproved(result.autoApproved);
            setStatus("submitted");
          } catch (error) {
            setStatus("idle");
            setMessage(error instanceof Error ? error.message : "Could not submit photo.");
          }
        }}
      />
      {status === "uploading" ? (
        <span className="text-xs font-black uppercase tracking-wide">Uploading…</span>
      ) : message ? (
        <span className="text-center text-xs font-semibold">{message}</span>
      ) : (
        (children ?? label)
      )}
    </label>
  );
}

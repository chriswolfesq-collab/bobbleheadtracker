"use client";

import { useEffect, useMemo, useState } from "react";
import { FORUM_IMAGE_ACCEPT, validateForumImageFile } from "@/lib/forumImages";

// The "Attach image" control shared by the topic composer and the reply box.
// It only *holds* the chosen file — the upload happens when the post is
// submitted, so an abandoned draft never leaves a file in the bucket. One
// image per post: the second pick replaces the first.
export function ForumImagePicker({
  file,
  onSelect,
  disabled,
}: {
  file: File | null;
  onSelect: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  // The preview object URL tracks the file's lifetime exactly; the effect only
  // revokes (no setState — the value itself is derived in render), which keeps
  // a long composing session from pinning every discarded pick in memory.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-black/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-zinc-600 transition hover:border-accent hover:text-accent-hover ${
            disabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
          {file ? "Change image" : "Attach image"}
          <input
            type="file"
            accept={FORUM_IMAGE_ACCEPT}
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              // Cleared so re-picking the same file still fires a change event.
              event.target.value = "";
              if (!picked) return;
              const invalid = validateForumImageFile(picked);
              if (invalid) {
                setError(invalid);
                return;
              }
              setError(null);
              onSelect(picked);
            }}
          />
        </label>

        {file && previewUrl ? (
          <span className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Attached image preview"
              className="h-10 w-10 rounded border border-black/10 object-cover"
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setError(null);
                onSelect(null);
              }}
              className="text-[11px] font-semibold text-zinc-500 underline-offset-2 transition hover:text-zinc-700 hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </span>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

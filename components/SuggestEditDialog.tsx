"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  MAX_DESCRIPTION_LENGTH,
  submitDescriptionEdit,
  useMyPendingDescriptionEdit,
} from "@/lib/descriptionEdits";
import { useDialog } from "@/lib/useDialog";

// The member half of description edits: a "Suggest an edit" button in the
// About This Bobblehead card that opens a dialog prefilled with the text as it
// reads today. The proposal lands in the team's review queue
// (/admin/edit-requests); nothing on the page changes until a rep or the
// admin publishes it. Same open-to-ask stance as tag requests.

function SuggestEditDialog({
  currentText,
  onClose,
  onSubmit,
}: {
  currentText: string;
  onClose: () => void;
  onSubmit: (proposed: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(currentText);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isSubmitting) return;
    onClose();
  };

  const panelRef = useDialog<HTMLDivElement>(true, close);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-edit-title"
        className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="suggest-edit-title" className="text-lg font-black text-zinc-900">
          Suggest an edit
        </h2>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          Rewrite the description the way you think it should read. The team&apos;s rep reviews it
          before it goes live — you know this bobblehead, they know the shelf.
        </p>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);

            if (draft.trim() === currentText.trim()) {
              setError("That's the description as it already reads — change something first.");
              return;
            }

            setIsSubmitting(true);
            try {
              await onSubmit(draft);
              onClose();
            } catch (submitError) {
              setError(
                submitError instanceof Error ? submitError.message : "Could not send that suggestion.",
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700">Description</label>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              required
              autoFocus
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-900 outline-none transition focus:border-accent"
            />
            <p className="text-[11px] leading-4 text-zinc-500">
              The whole text as it should appear, not just the correction.
            </p>
          </div>

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
            >
              {isSubmitting ? "Sending…" : "Send for review"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isSubmitting}
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:border-accent/60 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SuggestEditButton({
  teamSlug,
  bobbleheadId,
  source,
  currentText,
}: {
  teamSlug: string;
  bobbleheadId: string;
  source: "curated" | "community";
  /** The description as the page shows it right now — stored text or the
   *  computed fallback — so the proposer edits rather than starts blank. */
  currentText: string;
}) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { isPending, markPending } = useMyPendingDescriptionEdit(teamSlug, bobbleheadId);

  if (isPending) {
    return (
      <span className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
        Edit pending review
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!user) {
            setMessage("Log in to suggest an edit.");
            return;
          }
          setMessage(null);
          setIsOpen(true);
        }}
        className="text-[11px] font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
      >
        {message ? <span className="normal-case text-red-400">{message}</span> : "✎ Suggest an edit"}
      </button>

      {isOpen && user ? (
        <SuggestEditDialog
          currentText={currentText}
          onClose={() => setIsOpen(false)}
          onSubmit={async (proposed) => {
            const result = await submitDescriptionEdit({
              bobbleheadId,
              teamSlug,
              source,
              proposed,
              requestedBy: user.id,
            });
            if (result.error) throw new Error(result.error);
            markPending();
          }}
        />
      ) : null}
    </>
  );
}

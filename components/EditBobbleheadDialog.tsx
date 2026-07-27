"use client";

import { useState } from "react";
import { formatQuantity } from "@/lib/formatQuantity";
import { useDialog } from "@/lib/useDialog";

export type EditBobbleheadValues = { title: string; nickname: string; quantity: string; date: string };

const UNKNOWN_QUANTITY = "Unknown";

// The caller only mounts this (`{isOpen && <EditBobbleheadDialog ... />}`) while
// open, so a fresh instance — and fresh form state from `initial` — is
// guaranteed every time it's opened.
export function EditBobbleheadDialog({
  onClose,
  initial,
  onSave,
  onDelete,
  onRemovePhoto,
}: {
  onClose: () => void;
  initial: EditBobbleheadValues;
  onSave: (values: EditBobbleheadValues, file: File | null) => Promise<void>;
  onDelete: () => Promise<void>;
  // Only passed when a photo is actually on screen to remove. For a curated
  // listing with both an approved photo and a seed photo it takes two removals:
  // the first reveals the seed, the second clears it.
  onRemovePhoto?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [nickname, setNickname] = useState(initial.nickname);
  const [quantity, setQuantity] = useState(initial.quantity === UNKNOWN_QUANTITY ? "" : initial.quantity);
  const [quantityUnknown, setQuantityUnknown] = useState(initial.quantity === UNKNOWN_QUANTITY);
  const [date, setDate] = useState(initial.date);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isSaving || isDeleting || isRemovingPhoto;

  const close = () => {
    if (isBusy) return;
    onClose();
  };

  const panelRef = useDialog<HTMLDivElement>(true, close);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={close}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-bobblehead-title"
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50 dark:border-white/10 dark:bg-[#0b1a2b]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-bobblehead-title" className="text-lg font-black text-zinc-900 dark:text-white">Edit bobblehead</h2>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsSaving(true);

            try {
              await onSave(
                { title, nickname, quantity: quantityUnknown ? UNKNOWN_QUANTITY : formatQuantity(quantity), date },
                file,
              );
              onClose();
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : "Could not save changes.");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Player Name</label>
            <input
              required
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Nickname <span className="font-medium text-zinc-500 dark:text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="e.g. “La Regadera”"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
            />
            <p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
              Shown on a second line beneath the title.
            </p>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Number given away <span className="font-medium text-zinc-500 dark:text-zinc-400">(optional)</span>
            </label>
            <input
              type="text"
              value={quantity}
              disabled={quantityUnknown}
              onChange={(event) => setQuantity(event.target.value)}
              onBlur={(event) => setQuantity(formatQuantity(event.target.value))}
              placeholder="e.g. 25,000"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent disabled:opacity-50 dark:border-white/15 dark:bg-[#07111d] dark:text-white"
            />
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={quantityUnknown}
                onChange={(event) => setQuantityUnknown(event.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Quantity unknown</span>
            </label>
            <p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
              How many were handed out — a hint at how rare it is.
            </p>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Date</label>
            <input
              required
              type="text"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Replace photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              className="w-full text-xs text-zinc-700 dark:text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:tracking-wide file:text-accent-fg"
            />
            {onRemovePhoto ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={async () => {
                  setError(null);
                  setIsRemovingPhoto(true);

                  try {
                    await onRemovePhoto();
                    onClose();
                  } catch (removeError) {
                    setError(
                      removeError instanceof Error ? removeError.message : "Could not remove the photo.",
                    );
                  } finally {
                    setIsRemovingPhoto(false);
                  }
                }}
                className="justify-self-start text-xs font-black uppercase tracking-wide text-red-400 transition hover:text-red-300 disabled:opacity-60"
              >
                {isRemovingPhoto ? "Removing photo…" : "Remove current photo"}
              </button>
            ) : null}
          </div>

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-black uppercase tracking-wide text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isBusy}
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:border-accent/60 disabled:opacity-60 dark:border-white/15 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-black/10 pt-4 dark:border-white/10">
          {isConfirmingDelete ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p className="text-xs font-bold text-red-200">
                Delete this listing for everyone? Its photos, and every user&apos;s ownership and favorite marks for
                it, go too. This can&apos;t be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={async () => {
                    setError(null);
                    setIsDeleting(true);

                    try {
                      await onDelete();
                    } catch (deleteError) {
                      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this listing.");
                      setIsDeleting(false);
                      setIsConfirmingDelete(false);
                    }
                  }}
                  className="flex-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-400 disabled:opacity-60"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete it"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setIsConfirmingDelete(false)}
                  className="rounded-lg border border-black/10 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:border-accent/60 disabled:opacity-60 dark:border-white/15 dark:text-zinc-300"
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setIsConfirmingDelete(true)}
              className="text-xs font-black uppercase tracking-wide text-red-400 transition hover:text-red-300 disabled:opacity-60"
            >
              Delete listing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

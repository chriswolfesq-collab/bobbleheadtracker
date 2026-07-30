"use client";

import { useState } from "react";
import { formatQuantity } from "@/lib/formatQuantity";
import { useDialog } from "@/lib/useDialog";

export type EditBobbleheadValues = {
  title: string;
  nickname: string;
  quantity: string;
  date: string;
  /**
   * Only the Athletics have a city to pick between (Oakland or Sacramento), so
   * this is null everywhere else and the field isn't rendered at all — see
   * lib/athleticsCity.ts and the `cityOptions` prop.
   */
  city: string | null;
};

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
  cityOptions,
}: {
  onClose: () => void;
  initial: EditBobbleheadValues;
  onSave: (values: EditBobbleheadValues, file: File | null) => Promise<void>;
  onDelete: () => Promise<void>;
  // The cities this listing's team can be filed under. Only the Athletics pass
  // any; for every other team the field is absent and `city` stays null.
  cityOptions?: readonly string[];
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
  const [city, setCity] = useState(initial.city);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRemovingPhoto, setIsRemovingPhoto] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isSaving || isDeleting || isRemovingPhoto;
  const hasCityField = Boolean(cityOptions?.length);

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
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="edit-bobblehead-title" className="text-lg font-black text-zinc-900">Edit bobblehead</h2>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsSaving(true);

            try {
              await onSave(
                {
                  title,
                  nickname,
                  quantity: quantityUnknown ? UNKNOWN_QUANTITY : formatQuantity(quantity),
                  date,
                  city: hasCityField ? city : null,
                },
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
            <label className="text-xs font-bold text-zinc-700">Player Name</label>
            <input
              required
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700">
              Nickname <span className="font-medium text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="e.g. “La Regadera”"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent"
            />
            <p className="text-[11px] leading-4 text-zinc-500">
              Shown on a second line beneath the title.
            </p>
          </div>
          {hasCityField ? (
            <div className="grid gap-1.5">
              <span className="text-xs font-bold text-zinc-700">City</span>
              <div className="flex flex-wrap gap-4">
                {cityOptions?.map((option) => (
                  <label key={option} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="edit-bobblehead-city"
                      value={option}
                      checked={city === option}
                      onChange={() => setCity(option)}
                      className="h-3.5 w-3.5 accent-accent"
                    />
                    <span className="text-xs font-semibold text-zinc-700">{option}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] leading-4 text-zinc-500">
                Where the franchise was when this one was handed out.
              </p>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700">
              Number given away <span className="font-medium text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              value={quantity}
              disabled={quantityUnknown}
              onChange={(event) => setQuantity(event.target.value)}
              onBlur={(event) => setQuantity(formatQuantity(event.target.value))}
              placeholder="e.g. 25,000"
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent disabled:opacity-50"
            />
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={quantityUnknown}
                onChange={(event) => setQuantityUnknown(event.target.checked)}
                className="h-3.5 w-3.5 accent-accent"
              />
              <span className="text-xs font-semibold text-zinc-700">Quantity unknown</span>
            </label>
            <p className="text-[11px] leading-4 text-zinc-500">
              How many were handed out — a hint at how rare it is.
            </p>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700">Date</label>
            <input
              required
              type="text"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700">Replace photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              className="w-full text-xs text-zinc-700 file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:tracking-wide file:text-accent-fg"
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
              className="rounded-lg border border-black/10 px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:border-accent/60 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-black/10 pt-4">
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
                  className="rounded-lg border border-black/10 px-4 py-2 text-xs font-bold text-zinc-700 transition hover:border-accent/60 disabled:opacity-60"
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

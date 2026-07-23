"use client";

import { useState } from "react";

export type EditBobbleheadValues = { title: string; nickname: string; year: string; date: string };

// The National League's first season; no MLB bobblehead predates it. Upper bound
// leaves a little room for next-season promos that get catalogued early.
const MIN_YEAR = 1876;
const MAX_YEAR = new Date().getFullYear() + 2;

// Returns an error message if the year/date pair is invalid, or null if it's OK.
// Year must be a plausible 4-digit season, and when the free-text date carries a
// year of its own the two have to agree (no more "Year 2016 / Date April 2020").
function validateYearAndDate(year: string, date: string): string | null {
  const trimmedYear = year.trim();
  if (!/^\d{4}$/.test(trimmedYear)) {
    return "Year must be a 4-digit year, e.g. 2020.";
  }
  const yearNumber = Number(trimmedYear);
  if (yearNumber < MIN_YEAR || yearNumber > MAX_YEAR) {
    return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
  }
  const dateYear = date.match(/\b(\d{4})\b/)?.[1];
  if (dateYear && dateYear !== trimmedYear) {
    return `Year (${trimmedYear}) doesn't match the date's year (${dateYear}).`;
  }
  return null;
}

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
  // Only passed when the listing has a removable photo (an approved_photos
  // row or a community image), not for build-time curated seed photos.
  onRemovePhoto?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [nickname, setNickname] = useState(initial.nickname);
  const [year, setYear] = useState(initial.year);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={close}>
      <div
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-6 shadow-2xl shadow-black/50 dark:border-white/10 dark:bg-[#0b1a2b]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-black text-zinc-900 dark:text-white">Edit bobblehead</h2>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);

            const validationError = validateYearAndDate(year, date);
            if (validationError) {
              setError(validationError);
              return;
            }

            setIsSaving(true);

            try {
              await onSave({ title, nickname, year, date }, file);
              onClose();
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : "Could not save changes.");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Title</label>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Year</label>
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:border-accent dark:border-white/15 dark:bg-[#07111d] dark:text-white"
              />
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

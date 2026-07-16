"use client";

import { useState } from "react";

export type EditBobbleheadValues = { title: string; year: string; date: string };

// The caller only mounts this (`{isOpen && <EditBobbleheadDialog ... />}`) while
// open, so a fresh instance — and fresh form state from `initial` — is
// guaranteed every time it's opened.
export function EditBobbleheadDialog({
  onClose,
  initial,
  onSave,
  onDelete,
}: {
  onClose: () => void;
  initial: EditBobbleheadValues;
  onSave: (values: EditBobbleheadValues, file: File | null) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [year, setYear] = useState(initial.year);
  const [date, setDate] = useState(initial.date);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = isSaving || isDeleting;

  const close = () => {
    if (isBusy) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8" onClick={close}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b1a2b] p-6 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-black text-white">Edit bobblehead</h2>

        <form
          className="mt-5 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setIsSaving(true);

            try {
              await onSave({ title, year, date }, file);
              onClose();
            } catch (saveError) {
              setError(saveError instanceof Error ? saveError.message : "Could not save changes.");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-300">Title</label>
            <input
              required
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Year</label>
              <input
                required
                type="text"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold text-zinc-300">Date</label>
              <input
                required
                type="text"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-white/15 bg-[#07111d] px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-amber-400"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-bold text-zinc-300">Replace photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
              className="w-full text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-black file:uppercase file:tracking-wide file:text-[#07111d]"
            />
          </div>

          {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

          <div className="mt-1 flex gap-2">
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-black uppercase tracking-wide text-[#07111d] transition hover:bg-amber-300 disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={isBusy}
              className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-bold text-zinc-300 transition hover:border-amber-400/60 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="mt-5 border-t border-white/10 pt-4">
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
                  className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-zinc-300 transition hover:border-amber-400/60 disabled:opacity-60"
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

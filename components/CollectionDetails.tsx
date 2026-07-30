"use client";

import { useState } from "react";
import {
  CONDITIONS,
  CONDITION_LABELS,
  type CollectionDetail,
  formatAcquiredOn,
  formatPricePaid,
  hasAnyDetail,
  isCondition,
  parsePricePaid,
} from "@/lib/collectionDetails";
import { useCollectionDetail } from "@/lib/useCollectionDetail";

// The "what's actually on my shelf" half of the Collection Status card:
// condition, acquisition date, price paid, notes. Shown only to the owner of
// the bobblehead, because there's nothing to record about one you don't have.
//
// It opens read-only. Someone marking a hundred bobbleheads owned shouldn't
// have to dismiss a form a hundred times, so the form is behind a click and
// the resting state is either the details or a single line inviting them.

const INPUT_CLASS =
  "w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-accent";
const LABEL_CLASS = "text-xs font-black uppercase tracking-wide text-zinc-500";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={LABEL_CLASS}>{label}</dt>
      <dd className="text-sm font-semibold text-zinc-800">{value}</dd>
    </div>
  );
}

export function CollectionDetails({
  teamSlug,
  bobbleheadId,
}: {
  teamSlug: string;
  bobbleheadId: string;
}) {
  const { detail, isLoading, save } = useCollectionDetail(teamSlug, bobbleheadId);
  const [isEditing, setIsEditing] = useState(false);

  if (isLoading) {
    return <p className="mt-3 text-sm text-zinc-500">Loading your details…</p>;
  }

  if (isEditing) {
    return (
      <CollectionDetailsForm
        initial={detail}
        onCancel={() => setIsEditing(false)}
        onSave={async (next) => {
          const saved = await save(next);
          if (saved) setIsEditing(false);
          return saved;
        }}
      />
    );
  }

  const rows: Array<[string, string]> = [];
  if (detail.condition) rows.push(["Condition", CONDITION_LABELS[detail.condition]]);
  const acquired = formatAcquiredOn(detail.acquiredOn);
  if (acquired) rows.push(["Acquired", acquired]);
  const price = formatPricePaid(detail.pricePaid);
  if (price) rows.push(["Paid", price]);

  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      {hasAnyDetail(detail) ? (
        <>
          <dl className="grid gap-2">
            {rows.map(([label, value]) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </dl>
          {detail.notes?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
              {detail.notes}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-sm leading-6 text-zinc-600">
          Add the condition, when you got it, and what you paid.
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-3 cursor-pointer text-xs font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
      >
        {hasAnyDetail(detail) ? "Edit details" : "Add details"}
      </button>
    </div>
  );
}

function CollectionDetailsForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: CollectionDetail;
  onCancel: () => void;
  onSave: (next: CollectionDetail) => Promise<boolean>;
}) {
  const [condition, setCondition] = useState<string>(initial.condition ?? "");
  const [acquiredOn, setAcquiredOn] = useState(initial.acquiredOn ?? "");
  // Kept as typed text, not a number: an empty field has to stay distinct from
  // a deliberate 0 (a giveaway you were handed at the gate cost nothing).
  const [pricePaid, setPricePaid] = useState(
    initial.pricePaid === null ? "" : String(initial.pricePaid),
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-4 grid gap-3 border-t border-border-soft pt-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);

        const price = parsePricePaid(pricePaid);
        if ("error" in price) {
          setError(price.error);
          return;
        }

        setIsSaving(true);
        await onSave({
          condition: isCondition(condition) ? condition : null,
          acquiredOn: acquiredOn || null,
          pricePaid: price.value,
          notes: notes.trim() || null,
        });
        setIsSaving(false);
      }}
    >
      <fieldset className="grid gap-1.5">
        <legend className={LABEL_CLASS}>Condition</legend>
        {/* Three radios rather than a two-state toggle, so "not recorded" is a
            state you can choose and go back to, not just the one you start in. */}
        <div className="flex flex-wrap gap-2">
          {[["", "Not set"] as const, ...CONDITIONS.map((c) => [c, CONDITION_LABELS[c]] as const)].map(
            ([value, label]) => (
              <label
                key={value || "unset"}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  condition === value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border-soft text-zinc-600 hover:border-accent hover:text-accent-hover"
                }`}
              >
                <input
                  type="radio"
                  name="condition"
                  value={value}
                  checked={condition === value}
                  onChange={(event) => setCondition(event.target.value)}
                  className="sr-only"
                />
                {label}
              </label>
            ),
          )}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>Acquired</span>
          <input
            type="date"
            value={acquiredOn}
            onChange={(event) => setAcquiredOn(event.target.value)}
            className={`mt-1 ${INPUT_CLASS}`}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>Price paid</span>
          <input
            type="text"
            inputMode="decimal"
            value={pricePaid}
            onChange={(event) => setPricePaid(event.target.value)}
            placeholder="0.00"
            className={`mt-1 ${INPUT_CLASS}`}
          />
        </label>
      </div>

      <label className="block">
        <span className={LABEL_CLASS}>Notes</span>
        <textarea
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Where it came from, what's wrong with the box, who you'd trade it for…"
          className={`mt-1 resize-y ${INPUT_CLASS}`}
        />
      </label>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save details"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="cursor-pointer rounded-lg border border-border-soft px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-zinc-600 transition hover:border-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

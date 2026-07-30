"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { matchTags, tagHref } from "@/lib/tags";
import { useBobbleheadTags, useTagVocabulary } from "@/lib/useTags";

// The tags on one bobblehead, plus the picker an admin or team rep uses to
// change them. Everyone sees the chips; only an editor sees the controls.
//
// Chips link to the tag page rather than running a search, so "Star Wars" is a
// place you can link someone to rather than a query they have to retype.

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy transition";

export function TagList({
  teamSlug,
  bobbleheadId,
}: {
  teamSlug: string;
  bobbleheadId: string;
}) {
  const { tags, isLoading, addTag, removeTag } = useBobbleheadTags(teamSlug, bobbleheadId);
  const { canEditTeam } = useAdminAuth();
  const canEdit = canEditTeam(teamSlug);
  const [isEditing, setIsEditing] = useState(false);

  // Nothing to show and no way to add: the section would be an empty heading.
  if (isLoading || (tags.length === 0 && !canEdit)) return null;

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
          Tags
        </h2>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="cursor-pointer text-xs font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.slug}>
              {isEditing ? (
                <span className={CHIP_CLASS}>
                  {tag.label}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.slug)}
                    aria-label={`Remove the ${tag.label} tag`}
                    className="cursor-pointer text-sm leading-none text-zinc-500 transition hover:text-red-600"
                  >
                    <span aria-hidden>×</span>
                  </button>
                </span>
              ) : (
                <Link href={tagHref(tag.slug)} className={`${CHIP_CLASS} hover:border-accent hover:text-accent-hover`}>
                  {tag.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">No tags yet.</p>
      )}

      {isEditing ? <TagPicker onAdd={addTag} existing={tags.map((tag) => tag.slug)} /> : null}
    </div>
  );
}

function TagPicker({
  onAdd,
  existing,
}: {
  onAdd: (label: string) => Promise<boolean>;
  existing: string[];
}) {
  const { tags: vocabulary, reload } = useTagVocabulary();
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const taken = new Set(existing);
  const suggestions = matchTags(vocabulary, query).filter((tag) => !taken.has(tag.slug));

  const submit = async (label: string) => {
    if (!label.trim() || isSaving) return;
    setIsSaving(true);
    const added = await onAdd(label);
    setIsSaving(false);
    if (added) {
      setQuery("");
      // A brand new tag has to appear in the vocabulary, or typing it again on
      // the next listing offers no suggestion and mints it a second time.
      reload();
    }
  };

  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Star Wars, Sugar Skull…"
          aria-label="Add a tag"
          maxLength={40}
          className="w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={isSaving || !query.trim()}
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {suggestions.length > 0 ? (
        <>
          <p className="mt-3 text-xs font-black uppercase tracking-wide text-zinc-500">
            Already in use
          </p>
          {/* Clicking an existing tag is how the vocabulary stays shared —
              retyping it is what produces a near-duplicate. */}
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((tag) => (
              <li key={tag.slug}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => submit(tag.label)}
                  className="cursor-pointer rounded-full border border-border-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-600 transition hover:border-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tag.label}
                  <span className="ml-1.5 font-semibold text-zinc-400">{tag.listingCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

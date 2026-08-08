"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAuth } from "@/lib/auth";
import type { TagRequestSource } from "@/lib/tagRequests";
import { matchTags, type TagWithCount, tagHref } from "@/lib/tags";
import { describeSimilarity, findSimilarTags, type SimilarTag } from "@/lib/tagSimilarity";
import { useBobbleheadTags, useMyTagRequests, useTagVocabulary } from "@/lib/useTags";

// The tags on one bobblehead. Everyone sees the chips; what the controls do
// depends on who's looking. The admin edits directly — the vocabulary is
// theirs. Everyone else signed in requests: their picker files a tag_requests
// row for the admin to rule on at /admin/tag-requests, and their asks sit here
// as muted "pending" chips until then. Knowing a bobblehead is a Star Wars
// bobblehead doesn't take a rep, so this isn't gated on the team.
//
// Chips link to the tag page rather than running a search, so "Star Wars" is a
// place you can link someone to rather than a query they have to retype.

const CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-brass/40 bg-brass/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy transition";

const PENDING_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-full border border-dashed border-border-soft bg-transparent px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-500";

export function TagList({
  teamSlug,
  bobbleheadId,
  source = "curated",
}: {
  teamSlug: string;
  bobbleheadId: string;
  source?: TagRequestSource;
}) {
  const { tags, isLoading, addTag, removeTag } = useBobbleheadTags(teamSlug, bobbleheadId);
  const { pending, requestTag } = useMyTagRequests(teamSlug, bobbleheadId, source);
  const { isAdmin } = useAdminAuth();
  const { user } = useAuth();
  // Everyone else signed in requests rather than writes; the admin writes.
  const canRequest = !isAdmin && Boolean(user);
  const canEdit = isAdmin || canRequest;
  const [isEditing, setIsEditing] = useState(false);

  // Nothing to show and no way to add: the section would be an empty heading.
  if (isLoading || (tags.length === 0 && pending.length === 0 && !canEdit)) return null;

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
            {isEditing ? "Done" : isAdmin ? "Edit" : "Request a tag"}
          </button>
        ) : null}
      </div>

      {tags.length > 0 || pending.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag.slug}>
              {isEditing && isAdmin ? (
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
          {/* Only the requester sees these (the read is scoped to their own
              rows), so a listing never advertises unreviewed labels. */}
          {pending
            .filter((tag) => !tags.some((existing) => existing.slug === tag.slug))
            .map((tag) => (
              <li key={`pending-${tag.slug}`}>
                <span className={PENDING_CHIP_CLASS} title="Waiting for admin review">
                  {tag.label}
                  <span className="font-semibold normal-case tracking-normal text-zinc-400">
                    · pending
                  </span>
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">No tags yet.</p>
      )}

      {isEditing ? (
        <TagPicker
          onAdd={isAdmin ? addTag : requestTag}
          existing={[...tags.map((tag) => tag.slug), ...pending.map((tag) => tag.slug)]}
          isRequest={!isAdmin}
        />
      ) : null}
    </div>
  );
}

function TagPicker({
  onAdd,
  existing,
  isRequest,
}: {
  onAdd: (label: string) => Promise<boolean>;
  existing: string[];
  // A rep's submit files a request instead of writing the tag, so the wording
  // has to promise review rather than an add that already happened.
  isRequest: boolean;
}) {
  const { tags: vocabulary, reload } = useTagVocabulary();
  const [query, setQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Set when what was typed would mint a tag the vocabulary looks like it
  // already covers: the label, and what it looks like. Nothing is written while
  // this is open — the question is asked before the tag exists, because after
  // it exists someone has to go and merge it.
  const [maybeDuplicate, setMaybeDuplicate] = useState<{
    label: string;
    matches: SimilarTag<TagWithCount>[];
  } | null>(null);

  const taken = new Set(existing);
  const suggestions = matchTags(vocabulary, query).filter((tag) => !taken.has(tag.slug));

  const submit = async (label: string) => {
    if (!label.trim() || isSaving) return;
    setIsSaving(true);
    const added = await onAdd(label);
    setIsSaving(false);
    if (added) {
      setQuery("");
      setMaybeDuplicate(null);
      // A brand new tag has to appear in the vocabulary, or typing it again on
      // the next listing offers no suggestion and mints it a second time.
      reload();
    }
  };

  // Suggestions are already on screen, but a suggestion is easy to type past —
  // this is the same information as a question that has to be answered, and
  // only when the answer matters (the label would mint something new).
  const attempt = (label: string) => {
    const matches = findSimilarTags(label, vocabulary);
    if (matches.length === 0) {
      submit(label);
      return;
    }
    setMaybeDuplicate({ label, matches });
  };

  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      {isRequest ? (
        <p className="mb-3 text-xs text-zinc-500">
          Tag requests go to the site admin for review — they&apos;ll appear here once approved.
        </p>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          attempt(query);
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // The question was about the old text; keeping it up while someone
            // edits would invite answering it about the new text.
            setMaybeDuplicate(null);
          }}
          placeholder="Star Wars, Sugar Skull…"
          aria-label={isRequest ? "Request a tag" : "Add a tag"}
          maxLength={40}
          className="w-full rounded-lg border border-border-soft bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={isSaving || !query.trim()}
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRequest ? "Request" : "Add"}
        </button>
      </form>

      {maybeDuplicate ? (
        <div className="mt-3 rounded-lg border border-amber-400/60 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            <span className="font-bold">{maybeDuplicate.label}</span> looks like it&apos;s already
            covered
            {maybeDuplicate.matches.length === 1 ? "" : " by tags"}:
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {maybeDuplicate.matches.map((match) => (
              <li key={match.tag.slug}>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => submit(match.tag.label)}
                  className="cursor-pointer rounded-full border border-amber-500/60 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900 transition hover:border-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use {match.tag.label}
                  <span className="ml-1.5 font-semibold text-amber-700/70">
                    {match.tag.listingCount} · {describeSimilarity(match.reason)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* Deliberately still possible: two tags that look alike sometimes
                are two tags, and whoever is holding the bobblehead knows that
                better than the matcher does. It lands in the admin review queue
                either way. */}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => submit(maybeDuplicate.label)}
              className="cursor-pointer text-xs font-black uppercase tracking-wide text-amber-900 underline transition hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRequest ? "Request" : "Create"} {maybeDuplicate.label} anyway
            </button>
            <button
              type="button"
              onClick={() => setMaybeDuplicate(null)}
              className="cursor-pointer text-xs font-black uppercase tracking-wide text-zinc-500 transition hover:text-accent-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <>
          <p className="mt-3 text-xs font-black uppercase tracking-wide text-zinc-500">
            Pick one
          </p>
          {/* Clicking an existing tag is how the vocabulary stays shared —
              retyping it is what produces a near-duplicate. Some of these are
              seeded rather than earned, so the heading can't say "already in
              use" and the count is hidden until there's one to show. */}
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
                  {tag.listingCount > 0 ? (
                    <span className="ml-1.5 font-semibold text-zinc-400">{tag.listingCount}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

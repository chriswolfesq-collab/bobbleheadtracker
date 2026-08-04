"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import { getGiveawayById } from "@/lib/bobbleheads";
import {
  type CollectionCsvExportRow,
  type CollectionCsvProblem,
  type CollectionCsvRow,
  parseCollectionCsv,
  toCollectionCsv,
} from "@/lib/collectionCsv";
import { supabase } from "@/lib/supabase";
import { getTeamBySlug } from "@/lib/teams";

// Export and import of the whole tracked collection — owned, wanted and
// favorited, with the per-item details attached to the owned rows. A shelf that
// took years to tick off shouldn't only exist inside one database.
//
// Import is applied per row rather than as a replacement: a listing the file
// doesn't mention is left exactly as it is. That makes a partial file a useful
// thing to import, and means a truncated download can't wipe a shelf.

const CHUNK = 400;

type Summary = {
  applied: number;
  skipped: CollectionCsvProblem[];
};

function downloadCsv(csv: string, filename: string) {
  // text/csv with a BOM, so Excel opens it as UTF-8 rather than guessing at
  // the encoding and mangling a note with an accent in it.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CollectionTransfer() {
  const { user } = useAuth();
  const { showError } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  async function handleExport() {
    if (!user || isExporting) return;
    setIsExporting(true);

    try {
      const [collections, wants, favorites] = await Promise.all([
        supabase
          .from("user_collections")
          .select("bobblehead_id, team_slug, owned, condition, acquired_on, price_paid, notes")
          .eq("user_id", user.id),
        supabase.from("user_wants").select("bobblehead_id, team_slug, wanted").eq("user_id", user.id),
        supabase
          .from("user_favorites")
          .select("bobblehead_id, team_slug, favorited")
          .eq("user_id", user.id),
      ]);

      const failure = collections.error ?? wants.error ?? favorites.error;
      if (failure) throw new Error(failure.message);

      // One row per listing the user has touched in any of the three ways, so
      // a wanted-but-not-owned bobblehead still makes the file.
      const byKey = new Map<string, CollectionCsvRow>();
      const blank = (teamSlug: string, bobbleheadId: string): CollectionCsvRow => ({
        teamSlug,
        bobbleheadId,
        owned: false,
        wanted: false,
        favorite: false,
        condition: null,
        acquiredOn: null,
        pricePaid: null,
        notes: null,
      });
      const rowFor = (teamSlug: string, bobbleheadId: string) => {
        const key = `${teamSlug}:${bobbleheadId}`;
        const existing = byKey.get(key);
        if (existing) return existing;
        const created = blank(teamSlug, bobbleheadId);
        byKey.set(key, created);
        return created;
      };

      for (const row of collections.data ?? []) {
        const entry = rowFor(row.team_slug, row.bobblehead_id);
        entry.owned = row.owned;
        entry.condition = (row.condition as CollectionCsvRow["condition"]) ?? null;
        entry.acquiredOn = row.acquired_on;
        entry.pricePaid = row.price_paid;
        entry.notes = row.notes;
      }
      for (const row of wants.data ?? []) {
        rowFor(row.team_slug, row.bobblehead_id).wanted = row.wanted;
      }
      for (const row of favorites.data ?? []) {
        rowFor(row.team_slug, row.bobblehead_id).favorite = row.favorited;
      }

      // Titles for anything the bundled catalog doesn't carry. Community
      // listings are the only other source, and there are never many per user.
      const unknownIds = [...byKey.values()]
        .filter((row) => !getGiveawayById(row.bobbleheadId, row.teamSlug))
        .map((row) => row.bobbleheadId);

      const community = new Map<string, { title: string; year: string; date: string }>();
      if (unknownIds.length > 0) {
        const { data } = await supabase
          .from("community_bobbleheads")
          .select("id, team_slug, title, year, date")
          .in("id", unknownIds);
        for (const row of data ?? []) {
          community.set(`${row.team_slug}:${row.id}`, {
            title: row.title,
            year: row.year,
            date: row.date,
          });
        }
      }

      const exportRows: CollectionCsvExportRow[] = [...byKey.values()]
        .map((row) => {
          const curated = getGiveawayById(row.bobbleheadId, row.teamSlug);
          const fallback = community.get(`${row.teamSlug}:${row.bobbleheadId}`);
          const team = getTeamBySlug(row.teamSlug);
          return {
            ...row,
            team: team ? `${team.city} ${team.name}` : row.teamSlug,
            title: curated?.title ?? fallback?.title ?? "",
            year: curated?.year ?? fallback?.year ?? "",
            date: curated?.date ?? fallback?.date ?? "",
          };
        })
        .sort(
          (a, b) =>
            a.teamSlug.localeCompare(b.teamSlug) || a.bobbleheadId.localeCompare(b.bobbleheadId),
        );

      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(toCollectionCsv(exportRows), `bobbleshelf-collection-${stamp}.csv`);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Couldn't build that export. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(file: File) {
    if (!user || isImporting) return;
    setIsImporting(true);
    setSummary(null);

    try {
      const parsed = parseCollectionCsv(await file.text());
      if ("error" in parsed) {
        showError(parsed.error);
        return;
      }

      const problems = [...parsed.problems];

      // A typo'd id would otherwise become a row pointing at a listing that
      // doesn't exist — invisible on the site and impossible to clear from it.
      const unknownIds = parsed.rows
        .filter((row) => !getGiveawayById(row.bobbleheadId, row.teamSlug))
        .map((row) => row.bobbleheadId);

      const known = new Set<string>();
      if (unknownIds.length > 0) {
        const { data, error } = await supabase
          .from("community_bobbleheads")
          .select("id, team_slug")
          .in("id", unknownIds);
        if (error) throw new Error(error.message);
        for (const row of data ?? []) known.add(`${row.team_slug}:${row.id}`);
      }

      const usable = parsed.rows.filter((row, index) => {
        if (getGiveawayById(row.bobbleheadId, row.teamSlug)) return true;
        if (known.has(`${row.teamSlug}:${row.bobbleheadId}`)) return true;
        problems.push({
          // +2: past the header, and back to 1-based.
          line: index + 2,
          message: `no ${row.teamSlug} bobblehead with id ${row.bobbleheadId}`,
        });
        return false;
      });

      const now = new Date().toISOString();
      for (let start = 0; start < usable.length; start += CHUNK) {
        const batch = usable.slice(start, start + CHUNK);

        const { error } = await supabase.from("user_collections").upsert(
          batch.map((row) => ({
            user_id: user.id,
            bobblehead_id: row.bobbleheadId,
            team_slug: row.teamSlug,
            owned: row.owned,
            condition: row.condition,
            acquired_on: row.acquiredOn,
            price_paid: row.pricePaid,
            notes: row.notes,
            updated_at: now,
          })),
          // Team-scoped, like every other write to these tables — an import
          // holding the same curated id for two teams is two rows, not one
          // overwriting the other. See supabase/fix_collection_team_collisions.sql.
          { onConflict: "user_id,team_slug,bobblehead_id" },
        );
        if (error) throw new Error(error.message);

        const { error: wantsError } = await supabase.from("user_wants").upsert(
          batch.map((row) => ({
            user_id: user.id,
            bobblehead_id: row.bobbleheadId,
            team_slug: row.teamSlug,
            wanted: row.wanted,
            updated_at: now,
          })),
          { onConflict: "user_id,team_slug,bobblehead_id" },
        );
        if (wantsError) throw new Error(wantsError.message);

        const { error: favoritesError } = await supabase.from("user_favorites").upsert(
          batch.map((row) => ({
            user_id: user.id,
            bobblehead_id: row.bobbleheadId,
            team_slug: row.teamSlug,
            favorited: row.favorite,
            updated_at: now,
          })),
          { onConflict: "user_id,team_slug,bobblehead_id" },
        );
        if (favoritesError) throw new Error(favoritesError.message);
      }

      setSummary({ applied: usable.length, skipped: problems });
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Couldn't import that file. Please try again.",
      );
    } finally {
      setIsImporting(false);
      // Cleared so re-picking the same file after a fix still fires a change.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
      <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
        Your collection as a file
      </h2>
      <p className="mt-1.5 text-sm text-zinc-600">
        Download everything you own, want and have favorited — with condition, date, price and
        notes — as a spreadsheet. Import the same file back to restore it, on this account or
        another.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="cursor-pointer rounded-lg bg-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? "Building…" : "Export CSV"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isImporting}
          className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-zinc-700 transition hover:border-accent hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isImporting ? "Importing…" : "Import CSV"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Importing overwrites what you&apos;ve recorded for the bobbleheads named in the file.
        Anything the file doesn&apos;t mention is left alone.
      </p>

      {summary ? (
        <div className="mt-4 rounded-lg border border-black/10 bg-white p-3">
          <p className="text-sm font-semibold text-zinc-800">
            Imported {summary.applied} {summary.applied === 1 ? "bobblehead" : "bobbleheads"}.
          </p>
          {summary.skipped.length > 0 ? (
            <>
              <p className="mt-1.5 text-sm text-zinc-600">
                Skipped {summary.skipped.length}{" "}
                {summary.skipped.length === 1 ? "line" : "lines"}:
              </p>
              <ul className="mt-1 space-y-0.5">
                {/* Enough to fix the file without turning the page into the
                    file. The rest are counted, not listed. */}
                {summary.skipped.slice(0, 10).map((problem) => (
                  <li key={problem.line} className="text-xs text-zinc-500">
                    Line {problem.line} — {problem.message}
                  </li>
                ))}
              </ul>
              {summary.skipped.length > 10 ? (
                <p className="mt-1 text-xs text-zinc-500">
                  …and {summary.skipped.length - 10} more.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

import { describe, expect, it } from "vitest";
import {
  extractCandidates,
  normalizeTitle,
  parsePromoDate,
  scrapeAll,
  slugify,
} from "@/lib/giveawayScraper";

describe("parsePromoDate", () => {
  it("parses a month-name date with a year", () => {
    expect(parsePromoDate("Saturday, June 28, 2025", "2024")).toEqual({
      display: "June 28, 2025",
      year: "2025",
    });
  });

  it("borrows the default year when the date omits one", () => {
    expect(parsePromoDate("Sat June 28 — gates at 6", "2026")).toEqual({
      display: "June 28, 2026",
      year: "2026",
    });
  });

  it("handles abbreviated months and ordinal suffixes", () => {
    expect(parsePromoDate("Sept. 1st", "2025")).toEqual({ display: "September 1, 2025", year: "2025" });
  });

  it("parses numeric dates, expanding a two-digit year", () => {
    expect(parsePromoDate("6/28/25", "2024")).toEqual({ display: "June 28, 2025", year: "2025" });
    expect(parsePromoDate("06/28", "2025")).toEqual({ display: "June 28, 2025", year: "2025" });
  });

  it("returns null when there is no date", () => {
    expect(parsePromoDate("Bobblehead giveaway, first 20,000 fans", "2025")).toBeNull();
  });
});

describe("slugify / normalizeTitle", () => {
  it("slugify matches the community id scheme", () => {
    expect(slugify("J.D. Martinez (Iron Thrones)")).toBe("j-d-martinez-iron-thrones");
  });

  it("normalizeTitle collapses casing and punctuation for comparison", () => {
    expect(normalizeTitle("Tarik  SKUBAL!!")).toBe("tarik skubal");
  });
});

// A promo page in the shape team sites actually render: a table/list where each
// row is one promo with a date and a "<player> Bobblehead" description.
const PROMO_HTML = `
<html><body>
  <h2>2025 Promotional Schedule</h2>
  <ul class="promos">
    <li><span class="date">Saturday, April 26, 2025</span> — Kerry Carpenter Bobblehead (First 20,000 fans), presented by Meijer</li>
    <li><div class="date">Sat, May 10</div><div class="desc">Tarik Skubal Bobblehead Giveaway</div></li>
    <li>June 28 &middot; Tyler Holton Bobblehead Night, sponsored by Comerica</li>
    <li>July 4, 2025 — Fireworks Night (no giveaway)</li>
    <li>Aug 2, 2025 — Bobblehead Giveaway: Riley Greene</li>
  </ul>
</body></html>`;

describe("extractCandidates", () => {
  const candidates = extractCandidates(PROMO_HTML, "tigers", "https://example.com/promos", "2025");

  it("finds every bobblehead promo and ignores non-bobblehead rows", () => {
    const titles = candidates.map((c) => c.title).sort();
    expect(titles).toEqual(["Kerry Carpenter", "Riley Greene", "Tarik Skubal", "Tyler Holton"]);
  });

  it("pulls the date from an adjacent line when the bobblehead text has none", () => {
    const skubal = candidates.find((c) => c.title === "Tarik Skubal");
    expect(skubal?.date).toBe("May 10, 2025");
    expect(skubal?.year).toBe("2025");
  });

  it("derives a title from text that follows 'Bobblehead' when nothing precedes it", () => {
    const greene = candidates.find((c) => c.title === "Riley Greene");
    expect(greene?.date).toBe("August 2, 2025");
  });

  it("strips marketing suffixes, weekdays and dates from the title", () => {
    const carpenter = candidates.find((c) => c.title === "Kerry Carpenter");
    expect(carpenter?.title).toBe("Kerry Carpenter");
    expect(carpenter?.dedupeKey).toBe("kerry-carpenter-2025");
    expect(carpenter?.detectedText).toContain("Kerry Carpenter Bobblehead");
  });

  it("tags each candidate with its team and source url", () => {
    expect(candidates.every((c) => c.teamSlug === "tigers")).toBe(true);
    expect(candidates.every((c) => c.sourceUrl === "https://example.com/promos")).toBe(true);
  });

  it("dedupes repeats of the same promo within a page", () => {
    const dupHtml = PROMO_HTML + `<p>April 26, 2025 Kerry Carpenter Bobblehead again</p>`;
    const deduped = extractCandidates(dupHtml, "tigers", "https://example.com/promos", "2025");
    expect(deduped.filter((c) => c.title === "Kerry Carpenter")).toHaveLength(1);
  });

  it("returns nothing for a page with no bobblehead promos", () => {
    expect(extractCandidates("<p>Dollar Dog Night, June 1</p>", "tigers", "u", "2025")).toEqual([]);
  });
});

describe("scrapeAll", () => {
  it("fetches every source, aggregates candidates, and records per-source errors", async () => {
    const fakeFetch = (async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("tigers")) {
        return new Response(PROMO_HTML, { status: 200 });
      }
      if (href.includes("mets")) {
        return new Response("boom", { status: 500 });
      }
      return new Response("<p>nothing here</p>", { status: 200 });
    }) as typeof fetch;

    const { candidates, errors } = await scrapeAll(
      {
        tigers: [{ url: "https://example.com/tigers" }],
        mets: [{ url: "https://example.com/mets" }],
        cubs: [{ url: "https://example.com/cubs" }],
      },
      { defaultYear: "2025", fetchImpl: fakeFetch },
    );

    expect(candidates.map((c) => c.teamSlug)).toEqual(["tigers", "tigers", "tigers", "tigers"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ teamSlug: "mets", error: "http_500" });
  });

  it("dedupes a promo that appears on more than one of a team's sources", async () => {
    const fakeFetch = (async () => new Response(PROMO_HTML, { status: 200 })) as typeof fetch;
    const { candidates } = await scrapeAll(
      { tigers: [{ url: "https://a.com" }, { url: "https://b.com" }] },
      { defaultYear: "2025", fetchImpl: fakeFetch },
    );
    expect(candidates.filter((c) => c.title === "Kerry Carpenter")).toHaveLength(1);
  });
});

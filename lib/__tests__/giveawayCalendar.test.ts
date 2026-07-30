import { describe, expect, it } from "vitest";
import { buildIcs, type CalendarEvent, foldLine } from "@/lib/giveawayCalendar";

const NOW = Date.UTC(2026, 2, 1, 12, 0, 0);

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  uid: "brewers-jacob-misiorowski-2026@bobbleshelf.com",
  time: new Date(2026, 3, 11).getTime(),
  summary: "Jacob Misiorowski bobblehead — Milwaukee Brewers",
  description: "Stadium giveaway.",
  url: "https://bobbleshelf.com/teams/brewers/bobbleheads/jacob-misiorowski-2026",
  ...over,
});

// Every line in the output has to be checked against CRLF, not \n — a feed
// folded with bare newlines is rejected outright by several readers.
const linesOf = (ics: string) => ics.split("\r\n");

describe("buildIcs", () => {
  const ics = buildIcs({
    name: "Brewers giveaways",
    description: "Upcoming bobbleheads",
    events: [event()],
    now: NOW,
  });

  it("wraps the events in a calendar", () => {
    const lines = linesOf(ics);
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("uses CRLF and never a bare newline", () => {
    expect(ics.includes("\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  // A giveaway happens on the 17th wherever you read it from, so it's a DATE
  // value, not a timestamp — and derived from local parts, since going through
  // UTC would shift an evening game onto the following day.
  it("writes an all-day event on the local calendar day", () => {
    expect(linesOf(ics)).toContain("DTSTART;VALUE=DATE:20260411");
  });

  it("ends it the next morning, since DTEND is exclusive", () => {
    expect(linesOf(ics)).toContain("DTEND;VALUE=DATE:20260412");
  });

  it("names the calendar, so a subscriber doesn't see the feed URL", () => {
    expect(linesOf(ics)).toContain("X-WR-CALNAME:Brewers giveaways");
  });

  // The UID is what tells a client "this is the same event again" — without a
  // stable one, every refresh duplicates the whole season.
  it("carries the id it was given as the UID", () => {
    expect(ics).toContain("UID:brewers-jacob-misiorowski-2026@bobbleshelf.com");
  });

  it("escapes the separators that would otherwise split a value", () => {
    const escaped = buildIcs({
      name: "x",
      description: "y",
      events: [event({ summary: 'Bat Day; hats, too \\ "free"' })],
      now: NOW,
    });
    expect(escaped).toContain('SUMMARY:Bat Day\\; hats\\, too \\\\ "free"');
  });

  it("sends a newline in a description as the two characters", () => {
    const escaped = buildIcs({
      name: "x",
      description: "y",
      events: [event({ description: "first\nsecond" })],
      now: NOW,
    });
    expect(escaped).toContain("DESCRIPTION:first\\nsecond");
  });

  it("writes an empty but valid calendar when nothing is coming up", () => {
    const empty = buildIcs({ name: "x", description: "y", events: [], now: NOW });
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).toContain("END:VCALENDAR");
    expect(empty).not.toContain("BEGIN:VEVENT");
  });
});

describe("foldLine", () => {
  it("leaves a short line alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short");
  });

  it("folds a long line with CRLF and a leading space", () => {
    const folded = foldLine(`SUMMARY:${"a".repeat(200)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
  });

  it("keeps every line within the 75-octet limit", () => {
    const folded = foldLine(`DESCRIPTION:${"é".repeat(200)}`);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  // The limit is octets. Splitting at 75 characters instead would cut a
  // two-byte é in half and hand the reader an invalid sequence.
  it("never splits a multi-byte character", () => {
    const folded = foldLine(`DESCRIPTION:${"é".repeat(200)}`);
    expect(folded.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"é".repeat(200)}`);
    expect(folded).not.toContain("�");
  });

  it("round-trips an unfolded line back to the original", () => {
    const line = `SUMMARY:${"Bobblehead night ".repeat(20)}`;
    expect(foldLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});

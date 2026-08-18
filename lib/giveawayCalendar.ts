// An iCalendar feed of upcoming giveaways, so a schedule people already curated
// can live in the calendar they actually check. Subscribing beats a page you
// have to remember to visit.
//
// Hand-rolled rather than pulled from a package: RFC 5545 is a large spec, but
// the slice needed for a list of all-day events with a title and a link is
// small, and it's all string work with no runtime dependency worth taking on.

export type CalendarEvent = {
  /** Stable across regenerations, so a subscriber updates rather than duplicates. */
  uid: string;
  /** Local midnight of the giveaway day. */
  time: number;
  summary: string;
  description: string;
  url: string;
};

// A DATE value is the local calendar day with no zone attached, which is what a
// stadium giveaway is — it happens on the 17th wherever you're reading from.
// Deriving it from local parts rather than toISOString avoids the UTC shift
// that would move an evening game to the following day.
// A VALUE=DATE property is a bare calendar day, which is exactly what `time`
// anchors — so read it in UTC. The local getters would hand a subscriber west of
// UTC the day before, and adding 24h for DTEND below only lands on the next
// midnight cleanly on a scale that has no DST in it.
function toIcsDate(time: number): string {
  const date = new Date(time);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}${month}${day}`;
}

function toIcsTimestamp(time: number): string {
  return `${new Date(time).toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

// Backslash, semicolon and comma are value separators in a TEXT property, and a
// newline has to travel as the two characters \n.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 caps a content line at 75 octets, continued by CRLF plus a single
// space. The limit is octets, not characters, so an accented title has to be
// measured after encoding or the fold lands mid-codepoint and the line arrives
// corrupted.
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // 75 on the first line, 74 after, since the continuation's leading space
    // counts toward the octet budget.
    const budget = parts.length === 0 ? 75 : 74;
    let end = Math.min(start + budget, bytes.length);

    // Never split a UTF-8 sequence: continuation bytes are 10xxxxxx, so walk
    // back to the byte that starts the codepoint.
    while (end > start && end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end -= 1;
    }

    parts.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
  }

  return parts.join("\r\n ");
}

export function buildIcs({
  name,
  description,
  events,
  now,
}: {
  name: string;
  description: string;
  events: CalendarEvent[];
  /** Stamped on every event; passed in so the output is testable. */
  now: number;
}): string {
  const stamp = toIcsTimestamp(now);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BobbleShelf//Giveaway Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // Not in the spec, but it's what Google, Apple and Outlook read to name a
    // subscribed calendar. Without it they fall back to the feed URL.
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.time)}`,
      // DTEND is exclusive, so a one-day event ends the next morning. Without
      // it some clients render an open-ended or zero-length event.
      `DTEND;VALUE=DATE:${toIcsDate(event.time + 86_400_000)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      `URL:${escapeText(event.url)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

// Supabase Edge Function: the morning summary of unread threads on the
// moderators' forum. Fired once a day by the pg_cron job in
// supabase/mod_forum.sql, which calls send_forum_digest() — that function works
// out who hasn't read what and hands the finished per-person lists here. NOT
// called from the app, so like the other trigger-driven mailers it's deployed
// with --no-verify-jwt and gated by a shared secret header instead of a JWT.
//
// Dumb mailer by design: it never touches the database, so it needs no Supabase
// client and no service-role key. It also never decides *whether* to send —
// send_forum_digest() already dropped the caught-up recipients and filtered by
// each person's email preferences.
//
// Unlike rep-activity-digest, every recipient gets a different body: "unread"
// is per-person, so the payload is one entry per recipient and each one is
// rendered on its own.
//
// Deploy:
//   supabase functions deploy forum-digest --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body:
//   { recipients: [{ email, topic_count,
//                    topics: [{ id, title, who, snippet, new_replies }] }] }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const SITE = "https://bobbleshelf.com";
const RESEND_BATCH_LIMIT = 100;
// Past this the email is a wall of text and the link does the job better.
const MAX_TOPICS_SHOWN = 10;

type Topic = {
  id?: unknown;
  title?: unknown;
  who?: unknown;
  snippet?: unknown;
  new_replies?: unknown;
};

type Recipient = {
  email?: unknown;
  topics?: unknown;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

// The snippet arrives already capped at 240 characters by SQL; this only tidies
// the newlines so a multi-paragraph post reads as one line in the summary.
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function replyLine(count: number): string {
  if (count <= 0) return "new topic";
  return count === 1 ? "1 new reply" : `${count} new replies`;
}

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY not configured", { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const recipients: Recipient[] = Array.isArray(payload.recipients)
    ? (payload.recipients as Recipient[])
    : [];

  const messages = recipients.flatMap((recipient) => {
    const to = str(recipient.email);
    const topics: Topic[] = Array.isArray(recipient.topics) ? (recipient.topics as Topic[]) : [];

    // A recipient with nothing unread shouldn't be in the payload at all, but
    // dropping them here too keeps a SQL change from mailing an empty digest.
    if (!to.includes("@") || topics.length === 0) return [];

    const shown = topics.slice(0, MAX_TOPICS_SHOWN);
    const hidden = topics.length - shown.length;
    const subject =
      topics.length === 1
        ? `Bobble Shelf mods: 1 unread thread — ${oneLine(str(shown[0].title, "a topic"))}`
        : `Bobble Shelf mods: ${topics.length} unread threads`;

    const lines = shown.map((topic) => {
      const title = oneLine(str(topic.title, "Untitled"));
      const who = oneLine(str(topic.who, "someone"));
      const count = typeof topic.new_replies === "number" ? topic.new_replies : 0;
      const snippet = oneLine(str(topic.snippet));
      return { title, who, count, snippet, id: str(topic.id) };
    });

    const text =
      `${topics.length === 1 ? "One thread has" : `${topics.length} threads have`} activity you ` +
      `haven't read on the moderators' forum.\n\n` +
      lines
        .map(
          (line) =>
            `${line.title} — ${replyLine(line.count)}\n` +
            `    ${line.who}: ${line.snippet}\n` +
            `    ${SITE}/admin/forum/${line.id}`,
        )
        .join("\n\n") +
      (hidden ? `\n\n…and ${hidden} more.` : "") +
      `\n\nThe board: ${SITE}/admin/forum\n\n` +
      `Turn this daily summary off in Settings: ${SITE}/settings`;

    const html =
      `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
      `<p style="font-size:17px;">` +
      `<strong>${
        topics.length === 1 ? "One thread has" : `${topics.length} threads have`
      }</strong> activity you haven't read on the moderators' forum.</p>` +
      lines
        .map(
          (line) =>
            `<div style="margin:0 0 20px;padding-left:12px;border-left:3px solid #e5e5e5;">` +
            `<p style="margin:0 0 4px;">` +
            `<a href="${SITE}/admin/forum/${encodeURIComponent(line.id)}" style="font-weight:600;">${
              escapeHtml(line.title)
            }</a>` +
            ` <span style="color:#888;font-size:13px;">— ${replyLine(line.count)}</span></p>` +
            `<p style="margin:0;color:#555;font-size:14px;">` +
            `<strong>${escapeHtml(line.who)}:</strong> ${escapeHtml(line.snippet)}</p>` +
            `</div>`,
        )
        .join("") +
      (hidden ? `<p style="color:#888;">…and ${hidden} more.</p>` : "") +
      `<p><a href="${SITE}/admin/forum">Open the board</a></p>` +
      `<p style="color:#888;font-size:13px;">You're getting this because you moderate Bobble Shelf. ` +
      `Turn the daily summary off in <a href="${SITE}/settings">Settings</a>.</p>` +
      `</div>`;

    return [{ from: FROM, to: [to], subject, text, html }];
  });

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (let i = 0; i < messages.length; i += RESEND_BATCH_LIMIT) {
    const batch = messages.slice(i, i + RESEND_BATCH_LIMIT);
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const detail = await response.text();
      return new Response(`Resend error after ${sent} sent: ${detail}`, { status: 502 });
    }

    sent += batch.length;
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

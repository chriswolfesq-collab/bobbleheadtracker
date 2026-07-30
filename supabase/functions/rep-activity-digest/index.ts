// Supabase Edge Function: the end-of-day summary of what team reps changed on
// the site. Fired once a day by the pg_cron job in supabase/rep_activity.sql,
// which calls send_rep_activity_digest() — that function does the aggregation in
// SQL and hands the finished summary here. NOT called from the app, so like the
// other trigger-driven mailers it's deployed with --no-verify-jwt and gated by a
// shared secret header instead of a JWT.
//
// Dumb mailer by design: the digest never touches the database, so it needs no
// Supabase client and no service-role key. It also never decides *whether* to
// send — send_rep_activity_digest() already skipped the empty-day case and
// filtered the recipient list by each admin's email preferences.
//
// Deploy:
//   supabase functions deploy rep-activity-digest --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body:
//   { recipients: string[], hours: number, total: number,
//     actors: [{ email, total, samples: string[], actions: string[], teams: string[] }] }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const SITE = "https://bobbleshelf.com";
const RESEND_BATCH_LIMIT = 100;

type Actor = {
  email?: unknown;
  total?: unknown;
  samples?: unknown;
  actions?: unknown;
  teams?: unknown;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function teamNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
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

  const recipients = strings(payload.recipients).filter((r) => r.includes("@"));
  const actors: Actor[] = Array.isArray(payload.actors) ? (payload.actors as Actor[]) : [];
  const total = typeof payload.total === "number" ? payload.total : 0;
  const hours = typeof payload.hours === "number" ? payload.hours : 24;

  // The SQL side already refuses to call us on a quiet day, but a digest with no
  // recipients or no content is a no-op rather than an error either way.
  if (recipients.length === 0 || actors.length === 0 || total === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const window = hours === 24 ? "today" : `in the last ${hours} hours`;
  const changeWord = total === 1 ? "change" : "changes";
  const repWord = actors.length === 1 ? "rep" : "reps";

  const subject = `Bobble Shelf: ${total} ${changeWord} by ${actors.length} ${repWord} ${window}`;

  const textBlocks = actors.map((actor) => {
    const email = typeof actor.email === "string" ? actor.email : "unknown";
    const count = typeof actor.total === "number" ? actor.total : 0;
    const teams = strings(actor.teams).map(teamNameFromSlug);
    const samples = strings(actor.samples);
    const header = `${email} — ${count} ${count === 1 ? "change" : "changes"}${
      teams.length ? ` (${teams.join(", ")})` : ""
    }`;
    const lines = samples.map((s) => `    - ${s}`);
    const more = count > samples.length ? [`    …and ${count - samples.length} more`] : [];
    return [header, ...lines, ...more].join("\n");
  });

  const text =
    `${total} ${changeWord} by ${actors.length} team ${repWord} ${window}.\n\n` +
    `${textBlocks.join("\n\n")}\n\n` +
    `Full log: ${SITE}/admin/activity\n\n` +
    `Turn this daily summary off in Settings: ${SITE}/settings`;

  const htmlBlocks = actors.map((actor) => {
    const email = typeof actor.email === "string" ? actor.email : "unknown";
    const count = typeof actor.total === "number" ? actor.total : 0;
    const teams = strings(actor.teams).map(teamNameFromSlug);
    const samples = strings(actor.samples);
    const more = count > samples.length ? count - samples.length : 0;

    return (
      `<div style="margin:0 0 20px;">` +
      `<p style="margin:0 0 6px;"><strong>${escapeHtml(email)}</strong> — ${count} ${
        count === 1 ? "change" : "changes"
      }${teams.length ? ` <span style="color:#666;">(${escapeHtml(teams.join(", "))})</span>` : ""}</p>` +
      `<ul style="margin:0;padding-left:20px;color:#333;">` +
      samples.map((s) => `<li>${escapeHtml(s)}</li>`).join("") +
      (more ? `<li style="color:#666;">…and ${more} more</li>` : "") +
      `</ul></div>`
    );
  });

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
    `<p style="font-size:17px;"><strong>${total} ${changeWord}</strong> by ${actors.length} team ${repWord} ${window}.</p>` +
    htmlBlocks.join("") +
    `<p><a href="${SITE}/admin/activity">See the full log</a></p>` +
    `<p style="color:#888;font-size:13px;">You're getting this because you're an admin. ` +
    `Turn the daily summary off in <a href="${SITE}/settings">Settings</a>.</p>` +
    `</div>`;

  const messages = recipients.map((to) => ({
    from: FROM,
    to: [to],
    subject,
    text,
    html,
  }));

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

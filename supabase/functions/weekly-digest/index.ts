// Supabase Edge Function: the weekly "what's new for the teams you collect"
// email. Fired once a week by the pg_cron job in supabase/weekly_digest.sql,
// which calls send_weekly_digest() — that function does the per-recipient
// aggregation in SQL and hands the finished payload here. NOT called from the
// app, so like the other trigger-driven mailers it's deployed with
// --no-verify-jwt and gated by a shared secret header instead of a JWT.
//
// Dumb mailer by design: it never touches the database, so it needs no Supabase
// client and no service-role key. It also never decides *whether* to send —
// send_weekly_digest() already skipped the quiet week and filtered the recipient
// list by each collector's email preferences.
//
// Unlike the rep digest, every recipient gets different content: the whole
// point is that the list is scoped to the teams that person collects. So this
// builds one message per recipient rather than one message sent to many.
//
// Deploy:
//   supabase functions deploy weekly-digest --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body:
//   { days: number,
//     recipients: [{ email, total, samples: string[], teams: string[] }] }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const SITE = "https://bobbleshelf.com";
const RESEND_BATCH_LIMIT = 100;

type Recipient = {
  email?: unknown;
  total?: unknown;
  samples?: unknown;
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

// "the Dodgers", "the Dodgers and Mets", "the Dodgers, Mets and Cubs".
function joinTeams(names: string[]): string {
  if (names.length === 0) return "the teams you collect";
  if (names.length === 1) return `the ${names[0]}`;
  return `the ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
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

  const days = typeof payload.days === "number" ? payload.days : 7;
  const window = days === 7 ? "this week" : `in the last ${days} days`;

  const recipients: Recipient[] = Array.isArray(payload.recipients)
    ? (payload.recipients as Recipient[])
    : [];

  const messages = recipients
    .map((recipient) => {
      const to = typeof recipient.email === "string" ? recipient.email : "";
      const total = typeof recipient.total === "number" ? recipient.total : 0;
      const samples = strings(recipient.samples);
      const teams = strings(recipient.teams).map(teamNameFromSlug);

      // The SQL side only builds rows that have something in them, but a
      // recipient with nothing to say gets no email rather than an empty one.
      if (!to.includes("@") || total === 0) return null;

      const thing = total === 1 ? "bobblehead" : "bobbleheads";
      const subject = `${total} new ${thing} for ${joinTeams(teams)}`;
      const lead = `${total} new ${thing} ${
        total === 1 ? "was" : "were"
      } added ${window} for ${joinTeams(teams)}.`;
      const more = total > samples.length ? total - samples.length : 0;

      const text =
        `${lead}\n\n` +
        samples.map((title) => `  - ${title}`).join("\n") +
        (more ? `\n  …and ${more} more` : "") +
        `\n\nSee them: ${SITE}/recently-added\n\n` +
        `Turn this weekly email off in Settings: ${SITE}/settings`;

      const html =
        `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
        `<p style="font-size:17px;"><strong>${total} new ${thing}</strong> ${
          total === 1 ? "was" : "were"
        } added ${escapeHtml(window)} for ${escapeHtml(joinTeams(teams))}.</p>` +
        `<ul style="margin:0 0 20px;padding-left:20px;color:#333;">` +
        samples.map((title) => `<li>${escapeHtml(title)}</li>`).join("") +
        (more ? `<li style="color:#666;">…and ${more} more</li>` : "") +
        `</ul>` +
        `<p><a href="${SITE}/recently-added">See what's new</a></p>` +
        `<p style="color:#888;font-size:13px;">You're getting this because you track bobbleheads ` +
        `on ${escapeHtml(joinTeams(teams))}. ` +
        `Turn the weekly email off in <a href="${SITE}/settings">Settings</a>.</p>` +
        `</div>`;

      return { from: FROM, to: [to], subject, text, html };
    })
    .filter((message): message is NonNullable<typeof message> => message !== null);

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

// Supabase Edge Function: tells the admins when someone sends a message through
// the site — a /contact message or a "Become a team rep" application. Fired by
// the on_inbound_message_created database trigger via pg_net (see
// supabase/inbound_messages.sql), NOT called from the app — so like
// notify-wishlist-owner it's deployed with --no-verify-jwt and gated by a shared
// secret header instead of a JWT.
//
// The trigger has already resolved which admins want the mail (honoring their
// email preferences), so this function is a dumb mailer: it never touches the
// database, so it needs no Supabase client and no service-role key.
//
// Deploy:
//   supabase functions deploy notify-inbound-message --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body: { recipients: string[], kind, name, email, team_slug, message }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const SITE = "https://bobbleshelf.com";
// Resend's batch endpoint accepts at most 100 messages per call.
const RESEND_BATCH_LIMIT = 100;

function teamNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Keeps user-supplied text from breaking out of the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  // Fail closed: an unset WEBHOOK_SECRET rejects every request rather than
  // waving them through, so a misconfigured deploy can't leave this public
  // mailer open to spam.
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

  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter((r): r is string => typeof r === "string" && r.includes("@"))
    : [];
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const kind = payload.kind === "rep_application" ? "rep_application" : "contact";
  const senderName = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  const senderEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  const teamSlug = typeof payload.team_slug === "string" ? payload.team_slug.trim() : "";
  const message = typeof payload.message === "string" ? payload.message : "";

  const who = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const isApplication = kind === "rep_application";
  const teamName = teamSlug ? teamNameFromSlug(teamSlug) : "";

  const subject = isApplication
    ? `Team rep application — ${teamName}`
    : `New message from the Bobble Shelf contact form`;

  const adminLink = isApplication ? `${SITE}/admin/reps` : `${SITE}/admin/messages`;

  const text =
    (isApplication
      ? `${who} wants to be the team rep for the ${teamName}.\n\n`
      : `${who} sent a message through the contact form.\n\n`) +
    `${message}\n\n` +
    `---\nReply straight to this email to answer them.\n` +
    (isApplication
      ? `Assign them at ${adminLink} — the email to use is ${senderEmail}.\n`
      : `All messages: ${adminLink}\n`);

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
    `<p>${
      isApplication
        ? `<strong>${escapeHtml(who)}</strong> wants to be the team rep for the <strong>${escapeHtml(teamName)}</strong>.`
        : `<strong>${escapeHtml(who)}</strong> sent a message through the contact form.`
    }</p>` +
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #c9a24a;background:#faf5eb;white-space:pre-wrap;">` +
    `${escapeHtml(message)}</blockquote>` +
    `<p style="color:#555;">Reply straight to this email to answer them.</p>` +
    (isApplication
      ? `<p>Assign them at <a href="${adminLink}">${adminLink}</a> — the email to use is <strong>${escapeHtml(senderEmail)}</strong>.</p>`
      : `<p><a href="${adminLink}">All messages</a></p>`) +
    `</div>`;

  // One message per admin so nobody sees anyone else's address. reply_to is the
  // sender's own address, which makes answering them a plain Reply — this is why
  // the site no longer needs to publish an address of its own.
  const messages = recipients.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: senderEmail,
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

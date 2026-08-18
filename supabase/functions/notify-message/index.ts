// Supabase Edge Function: tells someone they have a new on-site message. Fired
// by the on_conversation_message_created database trigger via pg_net (see
// supabase/message_notifications.sql), NOT called from the app — so like
// notify-inbound-message it's deployed with --no-verify-jwt and gated by a
// shared secret header instead of a JWT.
//
// The trigger has already worked out who should hear about this: it applied the
// email preferences, excluded the sender, and claimed a per-thread cooldown slot
// for each recipient. So this is a dumb mailer — no database client, no
// service-role key, and no second opinion about who gets mail.
//
// Deliberately carries only a preview, never the whole message: the thread lives
// on the site, and mailing conversations in full would quietly turn an inbox
// people chose into email they didn't.
//
// Deploy:
//   supabase functions deploy notify-message --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are shared with the other functions.)
//
// Request body:
//   { recipients: string[], sender_label: string, sender_role: 'member'|'admin',
//     audience: 'admins'|'member', preview: string }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const SITE = "https://bobbleshelf.com";
// Resend's batch endpoint accepts at most 100 messages per call.
const RESEND_BATCH_LIMIT = 100;

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
  // waving them through, so a misconfigured deploy can't leave this open.
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

  const senderLabel =
    typeof payload.sender_label === "string" && payload.sender_label.trim()
      ? payload.sender_label.trim()
      : "A collector";
  const preview = typeof payload.preview === "string" ? payload.preview : "";
  // Admins are pointed at the queue they answer from; a member at their inbox.
  const toAdmins = payload.audience === "admins";
  const link = toAdmins ? `${SITE}/admin/messages` : `${SITE}/inbox`;

  const subject = toAdmins
    ? `New message from ${senderLabel}`
    : `${senderLabel} replied to your message`;

  const opening = toAdmins
    ? `${senderLabel} sent a message through the site.`
    : `${senderLabel} answered you.`;

  const text =
    `${opening}\n\n${preview}\n\n---\n` +
    `Read it and reply: ${link}\n` +
    `Replies happen on the site, not by email — answering this message won't reach anyone.\n` +
    (toAdmins ? "" : `Turn these off under Settings on the site.\n`);

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
    `<p><strong>${escapeHtml(senderLabel)}</strong> ${toAdmins ? "sent a message through the site." : "answered you."}</p>` +
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #c9a24a;background:#faf5eb;white-space:pre-wrap;">` +
    `${escapeHtml(preview)}</blockquote>` +
    `<p><a href="${link}">Read it and reply</a></p>` +
    `<p style="color:#555;">Replies happen on the site — answering this email won't reach anyone.` +
    (toAdmins ? "" : ` You can turn these off under Settings.`) +
    `</p></div>`;

  // One message per recipient so nobody sees anyone else's address. No reply_to:
  // this mail is a nudge to a thread, and a reply typed into an email client
  // would land nowhere the conversation can see it.
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

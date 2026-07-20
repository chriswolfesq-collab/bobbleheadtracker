// Supabase Edge Function: emails collectors when a bobblehead on their wishlist
// gains an owner. Fired by the on_collection_owned database trigger via pg_net
// (see supabase/wishlist_alerts.sql), NOT called from the app — so like
// notify-new-submission it's deployed with --no-verify-jwt and gated by a
// shared secret header instead of a JWT.
//
// The trigger has already done the sensitive part: resolved which wanters to
// tell, deduped them, and looked up their emails. This function is a dumb
// mailer — it never touches the database, so it needs no Supabase client and no
// service-role key.
//
// Deploy:
//   supabase functions deploy notify-wishlist-owner --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body: { recipients: string[], url: string }
// One message per recipient (a single "to" address each) so nobody sees anyone
// else's email.

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const REPLY_TO = "chriswolfesq@gmail.com";
// Resend's batch endpoint accepts at most 100 messages per call.
const RESEND_BATCH_LIMIT = 100;

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret && req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY not configured", { status: 500 });
  }

  let payload: { recipients?: unknown; url?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const recipients = Array.isArray(payload.recipients)
    ? payload.recipients.filter(
        (r): r is string => typeof r === "string" && r.includes("@"),
      )
    : [];
  const url = typeof payload.url === "string" ? payload.url : "https://bobbleshelf.com";

  // A trigger fired with no eligible wanters shouldn't reach here, but if it
  // does it's a no-op, not an error.
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const subject = "A bobblehead on your wishlist now has an owner";
  const text =
    "Good news — a bobblehead on your Bobble Shelf wishlist was just marked owned " +
    "by another collector.\n\n" +
    `See it here: ${url}\n\n` +
    "You're getting this because it's on your wishlist. You can turn these alerts " +
    "off anytime in Settings: https://bobbleshelf.com/settings";

  const messages = recipients.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    subject,
    text,
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
      return new Response(`Resend error after ${sent} sent: ${detail}`, {
        status: 502,
      });
    }

    sent += batch.length;
  }

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

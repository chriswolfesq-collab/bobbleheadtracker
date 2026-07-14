// Supabase Edge Function: emails the admin whenever a new row lands in
// `submissions`. Wired up via a Database Webhook (Database > Webhooks in the
// Supabase dashboard), not called directly by the app.
//
// Deploy:
//   supabase functions deploy notify-new-submission --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... WEBHOOK_SECRET=...
//
// Then create the webhook: table `submissions`, event `Insert`, type
// `HTTP Request`, URL = the deployed function URL, and add a custom header
// `x-webhook-secret: <same value as WEBHOOK_SECRET>` so only the real
// webhook can trigger an email (the function URL itself is otherwise public
// since it's deployed with --no-verify-jwt).

const ADMIN_EMAIL = "chriswolfesq@gmail.com";

Deno.serve(async (req) => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret && req.headers.get("x-webhook-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY not configured", { status: 500 });
  }

  const payload = await req.json();
  const submission = payload.record ?? {};

  const summary =
    submission.kind === "new_bobblehead"
      ? `New bobblehead: ${submission.title ?? "Untitled"} (${submission.team_slug})`
      : `Photo for existing bobblehead: ${submission.target_bobblehead_id} (${submission.team_slug})`;

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Bobble Shelf <alerts@bobbleshelf.com>",
      to: [ADMIN_EMAIL],
      subject: "New bobblehead submission pending review",
      text: `${summary}\n\nReview it at: https://chriswolfesq-collab.github.io/bobbleheadtracker/admin/review`,
    }),
  });

  if (!emailResponse.ok) {
    const body = await emailResponse.text();
    return new Response(`Resend error: ${body}`, { status: 502 });
  }

  return new Response("ok", { status: 200 });
});

// Supabase Edge Function: emails the admin whenever a new row lands in
// `submissions` or `listing_reports`, and emails the submitter back once
// their submission is approved or rejected. Wired up via Database Webhooks
// (see supabase/webhook_trigger.sql), not called directly by the app.
//
// Deploy:
//   supabase functions deploy notify-new-submission --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=... WEBHOOK_SECRET=...
//
// Then create a webhook per table (`submissions`, `listing_reports`),
// event `Insert`, type `HTTP Request`, URL = the deployed function URL, and
// add a custom header `x-webhook-secret: <same value as WEBHOOK_SECRET>` so
// only the real webhook can trigger an email (the function URL itself is
// otherwise public since it's deployed with --no-verify-jwt).

const ADMIN_EMAIL = "chriswolfesq@gmail.com";

const REASON_LABELS: Record<string, string> = {
  not_real: "Not a real listing",
  wrong_date: "Incorrect date",
  wrong_name: "Incorrect name",
  other: "Other",
};

function describeSubmission(record: Record<string, unknown>): string {
  return record.kind === "new_bobblehead"
    ? `"${record.title ?? "Untitled"}" (${record.team_slug})`
    : `your photo for ${record.target_bobblehead_id} (${record.team_slug})`;
}

function buildEmail(payload: Record<string, unknown>): { subject: string; text: string; to: string } {
  const table = (payload.table as string) ?? "submissions";
  const record = (payload.record as Record<string, unknown>) ?? {};

  if (payload.type === "UPDATE" && table === "submissions") {
    const summary = describeSubmission(record);
    const to = payload.submitter_email as string;

    if (record.status === "approved") {
      return {
        subject: "Your bobblehead submission was approved",
        text: `Good news — ${summary} was approved and is now live on Bobble Shelf.`,
        to,
      };
    }

    return {
      subject: "Your bobblehead submission was not approved",
      text: `${summary} was reviewed and was not approved.`,
      to,
    };
  }

  if (table === "listing_reports") {
    const reason = REASON_LABELS[record.reason as string] ?? (record.reason as string) ?? "Unknown reason";
    const summary = `${reason}: ${record.title ?? "Untitled"} (${record.team_slug})`;
    const details = record.details ? `\n\nDetails: ${record.details}` : "";

    return {
      subject: "New listing report pending review",
      text: `${summary}${details}\n\nReview it at: https://bobbleshelf.com/admin/reports`,
      to: ADMIN_EMAIL,
    };
  }

  const summary =
    record.kind === "new_bobblehead"
      ? `New bobblehead: ${record.title ?? "Untitled"} (${record.team_slug})`
      : `Photo for existing bobblehead: ${record.target_bobblehead_id} (${record.team_slug})`;

  return {
    subject: "New bobblehead submission pending review",
    text: `${summary}\n\nReview it at: https://bobbleshelf.com/admin/review`,
    to: ADMIN_EMAIL,
  };
}

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
  const { subject, text, to } = buildEmail(payload);

  if (!to) {
    return new Response("No recipient email available", { status: 400 });
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Bobble Shelf <alerts@bobbleshelf.com>",
      to: [to],
      subject,
      text,
    }),
  });

  if (!emailResponse.ok) {
    const body = await emailResponse.text();
    return new Response(`Resend error: ${body}`, { status: 502 });
  }

  return new Response("ok", { status: 200 });
});

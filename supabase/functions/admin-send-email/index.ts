// Supabase Edge Function: lets an admin send a one-off email to specific users,
// a hand-picked selection, or everyone. Called directly from the admin UI
// (lib/adminEmail.ts) via supabase.functions.invoke, NOT from a database
// webhook — so unlike notify-new-submission this one is deployed WITH JWT
// verification and re-checks admin status itself before doing anything.
//
// Deploy:
//   supabase functions deploy admin-send-email
//   supabase secrets set RESEND_API_KEY=...
//
// (RESEND_API_KEY is shared with notify-new-submission; set once.)
//
// Request body: { subject, body, recipientIds?: string[], all?: boolean }
//   - all: true      → email every registered user
//   - recipientIds   → email just those user ids
// Each recipient gets their own message (one "to" address per email), so
// addresses are never disclosed to one another.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const REPLY_TO = "chriswolfesq@gmail.com";
// Resend's batch endpoint accepts at most 100 messages per call.
const RESEND_BATCH_LIMIT = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SendRequest = {
  subject?: unknown;
  body?: unknown;
  recipientIds?: unknown;
  all?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase environment not configured" }, 500);
  }
  if (!resendApiKey) {
    return json({ error: "RESEND_API_KEY not configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization" }, 401);
  }

  // Re-check the caller is an admin using THEIR token — is_admin() reads
  // auth.uid() from the JWT, so this can't be spoofed by the client.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isAdmin, error: adminError } = await callerClient.rpc("is_admin");
  if (adminError) {
    return json({ error: adminError.message }, 500);
  }
  if (!isAdmin) {
    return json({ error: "Not authorized" }, 403);
  }

  let payload: SendRequest;
  try {
    payload = (await req.json()) as SendRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const wantAll = payload.all === true;
  const recipientIds = Array.isArray(payload.recipientIds)
    ? payload.recipientIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!subject) {
    return json({ error: "A subject is required" }, 400);
  }
  if (!body) {
    return json({ error: "A message is required" }, 400);
  }
  if (!wantAll && recipientIds.length === 0) {
    return json({ error: "No recipients selected" }, 400);
  }

  // Service-role client can read the auth schema to resolve ids → emails.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Build a full id → email map by paging through every user, then pick the
  // ones we actually want. Keeps a single code path for "all" vs. a selection.
  const emailById = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  // Cap the loop so a bug can never page forever.
  for (let guard = 0; guard < 1000; guard += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return json({ error: error.message }, 500);
    }
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  const targetIds = wantAll ? [...emailById.keys()] : recipientIds;
  const recipients = targetIds
    .map((id) => emailById.get(id))
    .filter((email): email is string => Boolean(email));

  if (recipients.length === 0) {
    return json({ error: "No valid recipient emails were found" }, 400);
  }

  // One message per recipient so nobody sees anyone else's address.
  const messages = recipients.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    subject,
    text: body,
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
      return json(
        { error: `Resend error after ${sent} sent: ${detail}`, sent },
        502,
      );
    }

    sent += batch.length;
  }

  return json({ sent });
});

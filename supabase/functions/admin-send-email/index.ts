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
// Request body:
//   { subject, body, recipientIds?: string[], recipientEmails?: string[],
//     all?: boolean, bccSelf?: boolean }
//   - all: true        → email every registered user
//   - recipientIds     → email just those user ids
//   - recipientEmails  → email these addresses directly, without needing an
//                        account to look up. This is how team reps are reached:
//                        team_reps is keyed by email (see schema.sql) and a rep
//                        can be assigned before they've ever signed up, so there
//                        may be no user id to resolve.
//   - bccSelf          → also BCC the sending admin, so they keep a copy of what
//                        went out. Defaults to TRUE for the recipientEmails path
//                        (the rep path) so it can't be forgotten there.
// Each recipient gets their own message (one "to" address per email), so
// addresses are never disclosed to one another.
//
// These are admin-composed, individually-addressed messages — direct
// correspondence, not notifications — so they deliberately do NOT consult the
// email preferences in supabase/email_preferences.sql. Those govern automated
// mail; an operator answering someone must not be silently swallowed by an
// unsubscribe flag.

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
  recipientEmails?: unknown;
  all?: unknown;
  bccSelf?: unknown;
};

function uniqueEmails(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().toLowerCase();
    if (trimmed.includes("@")) seen.add(trimmed);
  }
  return [...seen];
}

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

  // The sender's own address, for bccSelf. Taken from their token rather than the
  // request body so a copy can't be diverted to an address the caller names.
  const { data: caller } = await callerClient.auth.getUser();
  const callerEmail = caller?.user?.email?.toLowerCase() ?? null;

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
  const recipientEmails = uniqueEmails(payload.recipientEmails);
  // Defaults on for the address path (reps), off otherwise, so the rep button
  // can't ship without the copy the admin asked for.
  const bccSelf =
    payload.bccSelf === undefined ? recipientEmails.length > 0 : payload.bccSelf === true;

  if (!subject) {
    return json({ error: "A subject is required" }, 400);
  }
  if (!body) {
    return json({ error: "A message is required" }, 400);
  }
  if (!wantAll && recipientIds.length === 0 && recipientEmails.length === 0) {
    return json({ error: "No recipients selected" }, 400);
  }

  const resolved: string[] = [];

  // Only page the auth schema when there are ids to resolve. The rep path passes
  // addresses directly, and walking every user to send one email would be a lot
  // of work to learn nothing.
  if (wantAll || recipientIds.length > 0) {
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
    for (const id of targetIds) {
      const email = emailById.get(id);
      if (email) resolved.push(email);
    }
  }

  // Deduped so an address passed both ways doesn't get the message twice.
  const recipients = uniqueEmails([...resolved, ...recipientEmails]);

  if (recipients.length === 0) {
    return json({ error: "No valid recipient emails were found" }, 400);
  }

  // One message per recipient so nobody sees anyone else's address. The BCC copy
  // is dropped for the message addressed to the admin themselves, so they don't
  // get the same mail twice.
  const messages = recipients.map((to) => ({
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    ...(bccSelf && callerEmail && callerEmail !== to ? { bcc: [callerEmail] } : {}),
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

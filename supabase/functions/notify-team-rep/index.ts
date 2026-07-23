// Supabase Edge Function: welcomes a newly-promoted team rep by email, with a
// short guide to what they can now do. Fired by the on_team_rep_added database
// trigger via pg_net (see supabase/team_rep_welcome.sql), NOT called from the
// app — so like notify-wishlist-owner it's deployed with --no-verify-jwt and
// gated by a shared secret header instead of a JWT.
//
// The trigger fires once per genuinely new (email, team_slug) row —
// admin_assign_team_rep uses `on conflict do nothing`, so re-assigning an
// existing rep sends nothing further. This function is a dumb mailer: it never
// touches the database, so it needs no Supabase client and no service-role key.
//
// Deploy:
//   supabase functions deploy notify-team-rep --no-verify-jwt
//   (RESEND_API_KEY and WEBHOOK_SECRET are already set — shared with the other
//    functions; no new secrets needed.)
//
// Request body: { email: string, team_slug: string }

const FROM = "Bobble Shelf <alerts@bobbleshelf.com>";
const REPLY_TO = "chriswolfesq@gmail.com";
const SITE = "https://bobbleshelf.com";

// Turn a team slug ("red-sox", "blue-jays") into a display name ("Red Sox",
// "Blue Jays"). Matches the `name` field in lib/teams.ts closely enough for a
// greeting; the email also links to the team page where the real name shows.
function teamNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
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

  let payload: { email?: unknown; team_slug?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const teamSlug = typeof payload.team_slug === "string" ? payload.team_slug.trim() : "";

  if (!email.includes("@") || teamSlug === "") {
    return new Response("email and team_slug are required", { status: 400 });
  }

  const teamName = teamNameFromSlug(teamSlug);
  const teamUrl = `${SITE}/teams/${teamSlug}`;
  const adminUrl = `${SITE}/admin`;

  const subject = `You're now a team rep for the ${teamName} on Bobble Shelf`;

  const text =
    `You've been made a team rep for the ${teamName} on Bobble Shelf. ` +
    "That gives you the tools to keep your team's page accurate.\n\n" +
    "What you can now do (for the " + teamName + " only):\n" +
    "  - Edit any bobblehead on your team's page — fix a name, date, or photo.\n" +
    "  - Review submissions — approve or deny photos and new bobbleheads other\n" +
    "    collectors send in for your team.\n" +
    "  - Resolve listing reports — act on reports that a listing has wrong info.\n\n" +
    "How to get started:\n" +
    `  1. Sign in at ${SITE} with THIS email address (${email}) — it's your\n` +
    "     normal Bobble Shelf account. There's no separate admin password; your\n" +
    "     rep powers turn on automatically once you're signed in.\n" +
    `  2. Go to ${adminUrl} — you'll land in \"Team rep mode,\" which lists your\n` +
    "     team and links to the tools above.\n" +
    `  3. Or open your team page directly at ${teamUrl} — an Edit button now\n` +
    "     appears on each bobblehead.\n\n" +
    "If you don't have an account yet under this email, create one first at " +
    `${SITE}, then use the steps above.\n\n` +
    "Questions? Just reply to this email.";

  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;">` +
    `<p>You've been made a <strong>team rep for the ${teamName}</strong> on Bobble Shelf. ` +
    `That gives you the tools to keep your team's page accurate.</p>` +
    `<p><strong>What you can now do</strong> (for the ${teamName} only):</p>` +
    `<ul>` +
    `<li><strong>Edit any bobblehead</strong> on your team's page — fix a name, date, or photo.</li>` +
    `<li><strong>Review submissions</strong> — approve or deny photos and new bobbleheads other collectors send in for your team.</li>` +
    `<li><strong>Resolve listing reports</strong> — act on reports that a listing has wrong info.</li>` +
    `</ul>` +
    `<p><strong>How to get started:</strong></p>` +
    `<ol>` +
    `<li>Sign in at <a href="${SITE}">${SITE}</a> with <strong>this email address</strong> (${email}) — it's your normal Bobble Shelf account. There's no separate admin password; your rep powers turn on automatically once you're signed in.</li>` +
    `<li>Go to <a href="${adminUrl}">${adminUrl}</a> — you'll land in "Team rep mode," which lists your team and links to the tools above.</li>` +
    `<li>Or open your team page directly at <a href="${teamUrl}">${teamUrl}</a> — an Edit button now appears on each bobblehead.</li>` +
    `</ol>` +
    `<p>If you don't have an account yet under this email, create one first at <a href="${SITE}">${SITE}</a>, then use the steps above.</p>` +
    `<p style="color:#555;">Questions? Just reply to this email.</p>` +
    `</div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: REPLY_TO,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return new Response(`Resend error: ${detail}`, { status: 502 });
  }

  return new Response(JSON.stringify({ sent: 1 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

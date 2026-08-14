# One-time setup

1. Create a free project at supabase.com. From Settings > API, copy the
   **Project URL** and **anon public key**.
2. In the Supabase SQL Editor, run `schema.sql` (this repo, same folder).
3. Add the URL/key as GitHub Actions repo secrets: `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` (Settings > Secrets and variables > Actions).
4. For local dev, copy `.env.local.example` to `.env.local` and fill in the
   same two values.
5. Sign up for an account through the app's own login form using
   `chriswolfesq@gmail.com` — that email is hardcoded as the admin in
   `schema.sql`'s `is_admin()` function and in `lib/supabase.ts`'s
   `ADMIN_EMAIL`.
6. Run `seed_chris_collection.sql` once, to restore the existing collection
   under that account.
7. Run `dashboard_stats.sql` to add the `/admin/stats` metrics dashboard. Run
   it after `dead_images.sql` and `scraped_giveaways.sql` (below), since it
   reads those tables — or re-run it once they exist.

## Checking that email actually sends

Read this before setting up any of the mailers below, because the way they fail
gives you nothing to go on.

Every trigger-driven sender POSTs to an edge function with an `x-webhook-secret`
header, and the function rejects a mismatch with a 401. `net.http_post` is
fire-and-forget, so the sender returns success either way. Nothing appears in the
admin UI, no error reaches the app, and the only symptom is email that never
arrives — which looks identical to email nobody triggered.

Every sender in this project was once installed with the literal
`<WEBHOOK_SECRET>` still in it, because setup asked you to hand-substitute it in
six separate files. No automated email the site sends had ever worked, and
nothing said so.

The secret now lives in Vault and each sender calls `public.webhook_secret()` at
send time, so no file carries a value and there is nothing to substitute. See
`webhook_secret.sql` — it covers the health check, the migration, rotating, and
recovery.

The one honest test of whether email works is what the database got back:

```sql
select status_code, count(*), max(created) as latest
from net._http_response group by status_code order by 2 desc;
```

Anything other than `200` means that sender is dead. A sending function
returning without error proves nothing.

## Email notifications (optional)

Skip this if the in-app queue at `/admin/review` is enough on its own.

1. Create a free account at resend.com, get an API key.
2. Install the Supabase CLI, then from the repo root:
   ```
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy notify-new-submission --no-verify-jwt --use-api
   npx supabase secrets set RESEND_API_KEY=<your-resend-key> WEBHOOK_SECRET=<any-random-string>
   ```
3. Run `webhook_secret.sql` Part 2 to put the secret in Vault, then
   `webhook_trigger.sql` to install the triggers. Nothing to substitute.

There is no Database Webhook to create in the dashboard. An earlier version of
this setup used one; `webhook_trigger.sql` replaced it with ordinary trigger
functions calling `net.http_post`, which keeps the secret in one place
(`pg_proc`) where `webhook_secret.sql` can reach them all at once. If you go
looking for a webhook to edit, you won't find one — and recent dashboards moved that
screen under Integrations anyway.

## Branded confirmation email (optional)

Out of the box, Supabase Auth sends a plain, unbranded "Confirm your email
address" from `noreply@mail.app.supabase.io` — it never mentions Bobble Shelf
and looks a bit like spam. `email-templates/confirm-signup.html` (this repo,
same folder) replaces it with a branded version: the Bobble Shelf wordmark, the
shelf hero image, welcome copy, and a blue "Confirm email address" button.

1. In the Supabase dashboard: Authentication > Emails > Confirm signup.
2. Paste the full contents of `email-templates/confirm-signup.html` into the
   **Message body** field, and set the **Subject** to something like
   `Confirm your email for Bobble Shelf`. Save.
3. The template's only variable is `{{ .ConfirmationURL }}` — leave it as-is.
   The hero image loads from `https://bobbleshelf.com/shelf-filled.png` (the
   shelf with all 30 team bobbleheads, built by `scripts/build-shelf-filled.mjs`),
   so it only renders once the site is deployed under that domain.
4. To also fix the sender (so it comes from `Bobble Shelf
   <alerts@bobbleshelf.com>` instead of the Supabase address), set up custom
   SMTP under Authentication > Emails > SMTP settings — the same Resend account
   the edge functions already use will work.

## Password resets

An admin can unstick a locked-out account from `/admin/users`: **Reset password**
on their row emails them a one-time link that lands on `/reset-password`, where
they choose their own password. No password is ever typed into, or read from,
the admin console — so there's nothing to relay back over email or chat.

Step 1 is not optional. Without it the link still sends, but Supabase silently
ignores the redirect and drops people on the site's front page with no way to
set a password — which looks exactly like the feature is broken.

1. In the Supabase dashboard: Authentication > URL Configuration > **Redirect
   URLs**. Add both:
   - `https://bobbleshelf.com/reset-password`
   - `http://localhost:3000/reset-password` (so it can be tested in dev)

   Vercel preview deployments each get their own hostname, so add
   `https://*-<your-vercel-scope>.vercel.app/reset-password` too if you want
   resets to work on previews.
2. Optional, same as the signup email above: Authentication > Emails > **Reset
   Password**, paste in `email-templates/reset-password.html` and set the
   **Subject** to something like `Reset your Bobble Shelf password`. The
   default template is plain and unbranded; this one matches the confirmation
   email. Its only variable is `{{ .ConfirmationURL }}` — leave it as-is.

Notes:

- Supabase reports success whether or not the address has an account, so a
  "sent" confirmation in the admin console is not proof the person exists.
- It works for Google sign-ups too. They have no password today; following the
  link gives them one, and Google sign-in keeps working alongside it.
- Auth emails are rate-limited per project (Supabase's default is low — see
  Authentication > Rate Limits). Sending a handful in a row can start bouncing.

## Dead-image sweep (optional)

A nightly Vercel Cron job (`vercel.json` → `/api/dead-image-sweep`) crawls every
listing image URL — the curated seed URLs plus the admin/community/gallery
photos in the DB — and queues the broken ones at `/admin/dead-images`.

1. In the Supabase SQL Editor, run `dead_images.sql` (this repo, same folder).
2. In the Vercel project (Settings > Environment Variables), add:
   - `CRON_SECRET` — any random string. Vercel Cron sends it automatically as
     `Authorization: Bearer <value>`; the route rejects anything else, so it
     doubles as the manual-trigger key.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Settings > API. The sweep
     writes the queue past RLS with this key, so it must be a **server-side**
     (unexposed) env var — never prefix it with `NEXT_PUBLIC_`.
3. Deploy so Vercel registers the cron. To run it by hand:
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" https://bobbleshelf.com/api/dead-image-sweep
   ```

## New-giveaway scraper (optional)

A weekly Vercel Cron job (`vercel.json` → `/api/giveaway-scrape`) crawls each
team's promo-schedule page (`lib/promoSources.ts`), extracts bobblehead
giveaways it hasn't seen before, and drafts the genuinely new ones into a review
queue at `/admin/scraped-giveaways` — so new giveaways no longer have to be
hand-added to `data/giveaways/*.json`. Approving a draft publishes it as a live
community listing on that team's page; dismissing hides it.

1. In the Supabase SQL Editor, run `scraped_giveaways.sql` (this repo, same
   folder).
2. No new env vars — it reuses the `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`
   from the dead-image sweep above. If you skipped that section, add both now.
3. Deploy so Vercel registers the cron. To run it by hand:
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" https://bobbleshelf.com/api/giveaway-scrape
   ```
   The response reports how many candidates were found, how many were new
   drafts, and how many sources errored — handy for spotting a promo page that
   has moved or now renders its schedule client-side. Edit `lib/promoSources.ts`
   to point a team at a better source.

## Admin "email users" (optional)

Powers the Email / Email selected / Email all buttons on `/admin/users`.
Reuses the same Resend key as above.

1. Deploy the function (JWT verification stays ON — it re-checks the caller
   is an admin before sending anything):
   ```
   npx supabase functions deploy admin-send-email --use-api
   ```
2. If you skipped the section above, set the Resend key once:
   ```
   npx supabase secrets set RESEND_API_KEY=<your-resend-key>
   ```

No webhook is needed — the admin UI calls this function directly. `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected into every
function automatically.

## Email preferences (recommended)

Adds the master "email me nothing" switch and the per-type opt-outs on
`/settings`, and makes every automated sender check them.

1. In the SQL Editor, run `email_preferences.sql`.
2. Re-run these three, so their trigger functions pick up the new check:
   `wishlist_alerts.sql`, `webhook_trigger.sql`, `team_rep_welcome.sql`.
   (Remember to substitute `<WEBHOOK_SECRET>` in each before running — same
   value as `npx supabase secrets set WEBHOOK_SECRET=...`.)

Nothing to deploy. Note that admin-composed one-off emails deliberately ignore
these switches: they're direct correspondence, not notifications.

## Contact form and team-rep applications (recommended)

Backs `/contact` and `/become-a-rep`, and takes the owner's personal address off
the site — `/contact` used to publish it as a `mailto:` link.

1. In the SQL Editor, run `inbound_messages.sql` (needs `email_preferences.sql`
   first — the notifier calls `wants_email`). Substitute `<WEBHOOK_SECRET>`.
2. Deploy the mailer:
   ```
   npx supabase functions deploy notify-inbound-message --no-verify-jwt --use-api
   ```

Messages land in `/admin/messages`. The notification email's reply-to is the
sender's own address, so answering one is just Reply. The table is
write-for-anyone / read-for-admins, throttled to 3 per hour per address.

## Team rep activity log and daily digest (recommended)

Records who changed what, and emails the admins one summary at the end of each
day. Nothing recorded the actor before this — `submissions` and
`listing_reports` only had a `reviewed_at`.

1. In the SQL Editor, run `rep_activity.sql` (needs `email_preferences.sql`).
   Substitute `<WEBHOOK_SECRET>`. This also schedules the pg_cron job.
2. Deploy the mailer:
   ```
   npx supabase functions deploy rep-activity-digest --no-verify-jwt --use-api
   ```

The log is at `/admin/activity`, and only covers changes made after step 1 — it
can't backfill. The digest runs at 04:00 UTC (midnight US Eastern) and sends
nothing on a day with no rep activity. To change the hour, edit the
`cron.schedule` call at the bottom of `rep_activity.sql` and re-run it. To test
without waiting, run `select public.send_rep_activity_digest(24);`.

Only activity by *team reps* is summarized, not by full admins — the point is to
report what other people changed. Drop the `team_reps` filter in
`send_rep_activity_digest` to include everyone.

## Emailing team reps

The Email / Email all reps buttons on `/admin/reps` reuse the `admin-send-email`
function, so if you've already deployed it, redeploy to pick up the two
additions it needs — addressing by raw email (a rep can be assigned before they
ever sign up, so there may be no user id) and BCC'ing the sending admin:

```
npx supabase functions deploy admin-send-email --use-api
```

The BCC is on by default for the rep path, so every email to a rep copies you in.

## Per-item collection details (recommended)

Adds condition (in box / out of box), acquisition date, price paid and notes to
each bobblehead you own, recorded from the bobblehead's own page under
Collection Status.

1. In the SQL Editor, run `collection_details.sql`.

Nothing to deploy. These are four nullable columns on `user_collections` rather
than a table of their own, so the existing row-level security carries over
unchanged — a detail can't outlive the ownership row it hangs off, or be read by
anyone but its owner (and an admin, who could already read the row). Run it
*before* deploying the app code: until the columns exist, the details panel on
an owned bobblehead will fail to load and fail to save.

## Tags (recommended)

Adds cross-cutting labels — Star Wars, Sugar Skull, Peanuts, Game of Thrones —
that the team-and-year catalog has no other way to express. A tagged
bobblehead's page shows chips linking to `/tags/<slug>`; the tag directory is at
`/tags`; and site search matches tags, ranked just under the listing's own name.

1. In the SQL Editor, run `tags.sql` (needs `team_reps.sql` first — the write
   policies call `can_edit_team` and `is_team_rep`).

Nothing to deploy. Reads are public so a tag page renders for a crawler. Writes
are not: an admin or team rep can apply and mint tags, but renaming or deleting
one is admin-only, since `on delete cascade` takes every assignment with it. The
vocabulary is a table rather than a text column per listing — a free-text field
gives you "Star Wars", "star wars" and "StarWars" inside a week with no way to
merge them.

Tags start empty; there's no seed. Add them from any bobblehead's page while
signed in as an admin or that team's rep.

## Weekly roundup email (optional)

Once a week, tells each collector what was added for the teams they collect —
"3 new bobbleheads for the Dodgers and Mets". The only scheduled email that goes
to ordinary collectors rather than to admins, which is why it is scoped to teams
they've marked something owned or wanted on, and why a week with no additions
sends nothing at all.

1. In the SQL Editor, run `weekly_digest.sql` (needs `email_preferences.sql`).
   Substitute `<WEBHOOK_SECRET>`. This also schedules the pg_cron job.
2. Deploy the mailer:
   ```
   npx supabase functions deploy weekly-digest --no-verify-jwt --use-api
   ```

Only community additions count as new. A curated data import can land thousands
of rows at once, and an email announcing "1,400 new bobbleheads" the week of a
backfill is noise rather than news.

Runs Thursdays at 15:00 UTC — mid-morning US Eastern on a weekday, rather than
into a weekend backlog. To change it, edit the `cron.schedule` call at the bottom
of `weekly_digest.sql` and re-run the file. To test without waiting a week, run
`select public.send_weekly_digest(7);` — it returns how many recipients it built
a message for, and 0 means nobody qualified.

Note that `weekly_digest.sql` recreates `wants_email` and `set_email_preference`
in full. Both enumerate the known preference kinds and fail closed on an unknown
one, so the new switch has to be added inside them rather than alongside.

## Team Rep Forum

A private threaded board for admins and team reps, at `/admin/forum`. Named
for its main audience; admins are in it too. Reps are
spread across thirty teams and are rarely on the site at the same moment, so
this is a forum and not a chatroom: threads wait for the person they're
addressed to and stay searchable afterwards. One shared space — every moderator
sees every thread, and a topic's team label is a filter, not a wall.

1. In the SQL Editor, run `mod_forum.sql` (needs `team_reps.sql`,
   `email_preferences.sql` and `webhook_secret.sql`). Nothing to substitute —
   the digest reads the webhook secret from Vault. This also schedules the
   pg_cron job.
2. Deploy the mailer:
   ```
   npx supabase functions deploy forum-digest --no-verify-jwt --use-api
   ```

Writes go through SECURITY DEFINER RPCs rather than INSERT/UPDATE policies: RLS
can gate a row but not a column, and `pinned`, `locked` and `reply_count` must
not be author-writable. The tables carry SELECT policies only.

The digest runs daily at 13:00 UTC — 9am US Eastern, a morning nudge about what
came in overnight rather than another end-of-day email next to the rep summary.
Each recipient gets a different body, because "unread" is a different set for
each person; nobody with an empty list is mailed at all. To test without waiting,
run `select public.send_forum_digest(24);` — it returns the number of
person-threads it built messages for, and 0 means everyone is caught up.

Like `weekly_digest.sql`, this file recreates `wants_email` and
`set_email_preference` in full to add the `forum_digest` kind. Both fail closed
on an unknown kind, so a new switch has to go inside them rather than alongside.

## Profile photos (recommended)

Lets members add a profile picture from `/profile`. It shows in the site
header's account button and next to the author's name on every Team Rep Forum
topic and reply.

1. In the SQL Editor, run `avatars.sql` (needs `awards.sql` for
   `sync_profile_from_auth`, and `mod_forum.sql` for the forum read RPCs it
   recreates).

Nothing to deploy. The image lands in a new public `avatars` bucket, resized to
a 256px JPEG in the browser before upload; the database stores only the object
path, mirrored from auth `user_metadata` into `profiles.avatar_path` by the
same trigger that mirrors the display name. Run it *before* deploying the app
code — until the bucket and the recreated forum RPCs exist, photo uploads fail
with an error and forum bylines simply show initials.

## Images on forum posts (recommended)

Lets a moderator attach one image to a Team Rep Forum topic or reply — the
picker sits under the composer's text box, and the picture renders in the
thread, click to enlarge.

1. In the SQL Editor, run `forum_images.sql` (needs `mod_forum.sql`, then
   `avatars.sql` — it recreates the forum read RPCs *with* the avatar column
   they added).

Nothing to deploy. Unlike avatars the new `forum-images` bucket is **private**:
the board is private, so the app reads pictures through hour-long signed URLs
minted against the viewer's moderator session, and only moderators can upload
(into their own folder) or delete. Images are resized to at most 1600px in the
browser before upload. Deleting a post returns the orphaned paths to the client,
which sweeps the files best-effort; a missed sweep leaks an unreachable file,
nothing more. Run it *before* deploying the app code — the recreated write RPCs
change signature, so an old database with new code refuses every new post.

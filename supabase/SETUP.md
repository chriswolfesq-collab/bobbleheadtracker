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

## Email notifications (optional)

Skip this if the in-app queue at `/admin/review` is enough on its own.

1. Create a free account at resend.com, get an API key.
2. Install the Supabase CLI, then from the repo root:
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase functions deploy notify-new-submission --no-verify-jwt
   supabase secrets set RESEND_API_KEY=<your-resend-key> WEBHOOK_SECRET=<any-random-string>
   ```
3. In the Supabase dashboard: Database > Webhooks > Create a new webhook.
   - Table: `submissions`, Event: `Insert`, Type: `HTTP Request`
   - URL: the function URL printed by `supabase functions deploy`
   - Header: `x-webhook-secret: <the same random string from step 2>`

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
   supabase functions deploy admin-send-email
   ```
2. If you skipped the section above, set the Resend key once:
   ```
   supabase secrets set RESEND_API_KEY=<your-resend-key>
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
   value as `supabase secrets set WEBHOOK_SECRET=...`.)

Nothing to deploy. Note that admin-composed one-off emails deliberately ignore
these switches: they're direct correspondence, not notifications.

## Contact form and team-rep applications (recommended)

Backs `/contact` and `/become-a-rep`, and takes the owner's personal address off
the site — `/contact` used to publish it as a `mailto:` link.

1. In the SQL Editor, run `inbound_messages.sql` (needs `email_preferences.sql`
   first — the notifier calls `wants_email`). Substitute `<WEBHOOK_SECRET>`.
2. Deploy the mailer:
   ```
   supabase functions deploy notify-inbound-message --no-verify-jwt
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
   supabase functions deploy rep-activity-digest --no-verify-jwt
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
supabase functions deploy admin-send-email
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

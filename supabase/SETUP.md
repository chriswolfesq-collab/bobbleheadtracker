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

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

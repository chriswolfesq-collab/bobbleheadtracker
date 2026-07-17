# Bobbleshelf

[bobbleshelf.com](https://bobbleshelf.com) — every MLB stadium-giveaway (SGA) bobblehead, every team. Click your team on the shelf, browse its giveaway history, and track which bobbleheads you own.

## How it works

- **Next.js (App Router)**, server-rendered on Vercel. Most pages are static — the 30 team routes prerender at build time from curated JSON — but the site is a real Node server, which is what lets public shelf pages exist at arbitrary URLs and generate their own share images.
- **Supabase** provides everything dynamic: auth, per-user collections/favorites, community submissions, photos (Storage), and admin tooling. The browser talks to Supabase directly with the public anon key; all authorization is enforced by Row Level Security policies and `SECURITY DEFINER` functions in [supabase/schema.sql](supabase/schema.sql). There is no service-role key anywhere: server-rendered pages use the same anon key and are bound by the same RLS.
- **Curated data** — the giveaway history for all 30 teams — lives in one JSON file per team under [data/giveaways/](data/giveaways) and is baked into the site at build time by [lib/bobbleheads.ts](lib/bobbleheads.ts). Admin edits and deletions of curated listings are recorded in the `bobblehead_overrides` table and applied client-side.
- **Community data** — user-submitted bobbleheads and photos — goes through a pending-review queue (`submissions` table plus a private Storage bucket) and appears publicly once the admin approves it at `/admin/review`.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in the Supabase URL + anon key
npm run dev
```

Other scripts:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest unit tests
npm run build       # production build (same as CI)
```

## Supabase setup

One-time project setup (buckets, tables, RLS, admin account) is documented in [supabase/SETUP.md](supabase/SETUP.md). The schema in [supabase/schema.sql](supabase/schema.sql) is safe to re-run in the SQL editor after every change to it — that is also how schema changes are deployed.

## Editing curated data

Fix a title/date or add a newly announced giveaway by editing the team's file in [data/giveaways/](data/giveaways) and deploying. Entry shape:

```json
{ "id": "player-name-2026", "title": "Player Name", "year": "2026", "date": "July 4, 2026" }
```

`id` must be unique within the team and never change once shipped — user collections and favorites reference it.

## Admin mode

`/admin` is a separate login (its session is stored apart from the regular site login). Accounts listed in the `admins` table get: the review queue (`/admin/review`), listing reports (`/admin/reports`), user management (`/admin/users`), and inline edit/delete controls on listing pages.

## Deployment

Vercel builds and deploys on every push: `main` goes to production at [bobbleshelf.com](https://bobbleshelf.com), and every pull request gets its own preview URL. The Supabase URL and anon key are set as environment variables in the Vercel project, not in this repo.

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs the same checks (lint, typecheck, tests, build) independently on push and PR, so a broken commit fails loudly in GitHub rather than only in the Vercel dashboard.

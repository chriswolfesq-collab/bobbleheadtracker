-- Data cleanup for community listings and overrides (July 2026 overhaul).
-- Run in the Supabase SQL editor. Each statement is idempotent.

-- 1. "Jermey" typo (community submission baked into the title; slug/id stays).
update community_bobbleheads
set title = replace(title, 'Jermey', 'Jeremy')
where title like '%Jermey%';

-- 2. "Orbit Sugarskull" duplicated its descriptor in the title; keep the
--    descriptor in the nickname field only.
update community_bobbleheads
set title = 'Orbit'
where title = 'Orbit Sugarskull' and nickname = 'Sugarskull';

-- 3. Trim stray whitespace in titles/nicknames (the leading-space nickname
--    that produced a double-hyphen slug, and any friends).
update community_bobbleheads
set title = btrim(title), nickname = nullif(btrim(nickname), '')
where title <> btrim(title)
   or nickname is distinct from nullif(btrim(nickname), '');

-- 4. Numeric-string dates -> catalog date format.
update community_bobbleheads
set date = 'May 30, 2026'
where date = '5/30/2026';

update bobblehead_overrides
set date = 'August 11, 2025'
where team_slug = 'astros'
  and bobblehead_id = 'yordan-alvarez-city-connect-2025'
  and date = '8/11/2025';

-- 5. Any other overrides carrying M/D/YYYY dates, normalized generically.
--    (Postgres to_date handles the parse; only rows matching the pattern move.)
update bobblehead_overrides
set date = to_char(to_date(date, 'MM/DD/YYYY'), 'FMMonth FMDD, YYYY')
where date ~ '^\d{1,2}/\d{1,2}/\d{4}$';

update community_bobbleheads
set date = to_char(to_date(date, 'MM/DD/YYYY'), 'FMMonth FMDD, YYYY')
where date ~ '^\d{1,2}/\d{1,2}/\d{4}$';

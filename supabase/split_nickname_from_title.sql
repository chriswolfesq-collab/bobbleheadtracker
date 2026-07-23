-- Moves a title's trailing parenthetical into the dedicated `nickname` column,
-- matching what the catalog JSON already carries (data/giveaways/*.json) and
-- what components/BobbleheadTitle.tsx renders from a trailing parenthetical.
-- e.g. "Corbin Carroll (30/30, Stealing)" -> title "Corbin Carroll",
--      nickname "30/30, Stealing".
--
-- Idempotent and safe to re-run: it only touches rows that still have an empty
-- nickname, and only when a trailing "(...)" leaves a non-empty title behind
-- (mirrors splitTitle's guards — a whole-title parenthetical or an empty inner
-- string is left alone). The "[^()]+" keeps it to a single, non-nested trailing
-- group, which covers every affected row today. Paste into the Supabase SQL
-- editor.

update public.community_bobbleheads
set nickname = trim(substring(title from '\(([^()]+)\)\s*$')),
    title    = trim(regexp_replace(title, '\s*\([^()]+\)\s*$', ''))
where (nickname is null or trim(nickname) = '')
  and title ~ '\([^()]+\)\s*$'
  and trim(regexp_replace(title, '\s*\([^()]+\)\s*$', '')) <> '';

update public.bobblehead_overrides
set nickname = trim(substring(title from '\(([^()]+)\)\s*$')),
    title    = trim(regexp_replace(title, '\s*\([^()]+\)\s*$', ''))
where title is not null
  and (nickname is null or trim(nickname) = '')
  and title ~ '\([^()]+\)\s*$'
  and trim(regexp_replace(title, '\s*\([^()]+\)\s*$', '')) <> '';

-- Submissions is the public-form queue (empty today); clean it too so a future
-- pending entry carries a proper nickname through to approval.
update public.submissions
set nickname = trim(substring(title from '\(([^()]+)\)\s*$')),
    title    = trim(regexp_replace(title, '\s*\([^()]+\)\s*$', ''))
where title is not null
  and (nickname is null or trim(nickname) = '')
  and title ~ '\([^()]+\)\s*$'
  and trim(regexp_replace(title, '\s*\([^()]+\)\s*$', '')) <> '';

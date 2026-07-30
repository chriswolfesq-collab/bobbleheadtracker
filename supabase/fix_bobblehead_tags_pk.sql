-- Widens the bobblehead_tags primary key to include team_slug.
--
-- The key was (bobblehead_id, tag_slug), which assumes a bobblehead id is
-- unique across the whole catalog. It isn't -- ids are unique within a team
-- file, and 36 of them are shared between teams. The Reds' "chewbacca-2018"
-- and the Mariners' "chewbacca-2018" are different bobbleheads, so tagging
-- both meant the second insert hit `on conflict do nothing` and disappeared
-- without an error.
--
-- The collisions are almost all licensed characters, which is exactly what
-- tags are for: elmo-2023 is five teams, charlie-brown-2017 is four, and
-- hello-kitty collides in three separate years. Under the old key, tagging
-- Elmo "Sesame Street" would have labelled one of those five and silently
-- dropped the rest.
--
-- team_slug was already on the row, denormalized so the RLS policy can
-- authorize a rep without joining out. It just belonged in the identity too:
-- what carries a tag is a listing, and it takes both columns to name one.
--
-- Idempotent -- re-running finds the key already widened and does nothing.
-- Paste into the Supabase SQL editor. Run this BEFORE re-running
-- supabase/seed_star_wars_tag.sql, which has two rows waiting on it.
--
-- No data is lost: widening a key can only make previously-equal rows
-- distinct, never the reverse, so every existing assignment survives.

do $$
declare
  pk_name text;
  covers_team boolean;
begin
  select c.conname,
         exists (
           select 1
           from unnest(c.conkey) as k(attnum)
           join pg_attribute a
             on a.attrelid = c.conrelid and a.attnum = k.attnum
           where a.attname = 'team_slug'
         )
    into pk_name, covers_team
  from pg_constraint c
  where c.conrelid = 'public.bobblehead_tags'::regclass
    and c.contype = 'p';

  if pk_name is null then
    raise exception 'bobblehead_tags has no primary key -- run supabase/tags.sql first';
  end if;

  if covers_team then
    raise notice 'primary key already covers team_slug; nothing to do';
    return;
  end if;

  execute format('alter table public.bobblehead_tags drop constraint %I', pk_name);

  -- bobblehead_id stays the leading column, so the listing page's read by
  -- bobblehead_id still has an index to use.
  alter table public.bobblehead_tags
    add constraint bobblehead_tags_pkey
    primary key (bobblehead_id, team_slug, tag_slug);

  raise notice 'primary key widened to (bobblehead_id, team_slug, tag_slug)';
end $$;

-- The key as it now stands. Expect all three columns, in this order.
select a.attname, k.ord
from pg_constraint c
cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.conrelid = 'public.bobblehead_tags'::regclass
  and c.contype = 'p'
order by k.ord;

-- Stops a public shelf counting bobbleheads that no longer exist.
--
-- get_public_shelf counts a user's owned rows straight out of user_collections.
-- Deleting a listing (an admin edit, recorded as bobblehead_overrides.deleted)
-- doesn't clear anyone's row, so those rows kept counting: a shelf's "N of M"
-- had bobbleheads in N whose pages 404, over an M the site had already stopped
-- counting them in — and its owner's own /profile, which now skips them
-- client-side, disagreed with the shelf they shared.
--
-- The site fixes the same thing for its own reads in lib/profile.ts and
-- lib/publicShelf.ts. This one has to be here: the aggregate is over another
-- user's private rows, which only this security-definer function can see.
--
-- Idempotent — safe to run more than once. Paste into the Supabase SQL editor.

create or replace function public.get_public_shelf(p_slug text)
returns table (display_name text, counts jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.display_name,
    coalesce(
      (
        select jsonb_object_agg(t.team_slug, t.cnt)
        from (
          select c.team_slug, count(*)::int as cnt
          from public.user_collections c
          where c.user_id = p.id
            and c.owned
            and not exists (
              select 1
              from public.bobblehead_overrides o
              where o.team_slug = c.team_slug
                and o.bobblehead_id = c.bobblehead_id
                and o.deleted
            )
          group by c.team_slug
        ) t
      ),
      '{}'::jsonb
    )
  from public.profiles p
  where p.slug = p_slug and p.is_public;
$$;

grant execute on function public.get_public_shelf(text) to anon, authenticated;

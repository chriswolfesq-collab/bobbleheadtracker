-- Photo voting: collectors pick a listing's best photo, and the top-voted
-- photo becomes the listing's main photo. The first community-curation
-- feature — the site edges toward "the users decide what's most accurate".
--
-- One vote per member per listing (not per photo): the question is "which is
-- best", not "which do you like". Votes name the photo by URL, because that's
-- the only identity every photo layer shares — the curated seed photo lives
-- in build-time JSON with no database row, the approved main lives in
-- approved_photos keyed by listing, and gallery photos have uuids the main
-- photo lacks. The key carries team_slug for the same reason user_favorites
-- does: 36 curated ids repeat across teams (see fix_collection_team_collisions).
--
-- Promotion is materialized into approved_photos rather than derived at
-- render time, on purpose: the existing revalidate triggers on
-- approved_photos/bobblehead_gallery_photos then regenerate the static pages
-- for free, and only when the *winner* changes — a tally that merely ticks up
-- doesn't re-render ~3,650 pages. Tallies themselves are read client-side.
--
-- Needs: schema.sql. Nothing else.

-- ---------------------------------------------------------------------------
-- Part 1: the table
-- ---------------------------------------------------------------------------

create table if not exists public.photo_votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  team_slug text not null,
  bobblehead_id text not null,
  image_url text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, team_slug, bobblehead_id)
);

create index if not exists photo_votes_listing_idx
  on public.photo_votes (team_slug, bobblehead_id);

-- RLS is enabled with NO policies: unlike favorites (private, direct table
-- access) every read and write here goes through the RPCs below, because a
-- vote has to trigger the promotion check and a tally must be public without
-- exposing who voted for what.
alter table public.photo_votes enable row level security;

-- ---------------------------------------------------------------------------
-- Part 2: rate limit
-- ---------------------------------------------------------------------------
-- Same shape and SQLSTATE as the other limits, so lib/rateLimit.ts already
-- recognizes the refusal. 60 writes an hour is far past honest browsing and
-- well short of useful ballot-stuffing.

create or replace function public.enforce_photo_vote_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  select count(*) into v_recent
  from public.photo_votes
  where user_id = new.user_id and updated_at > now() - interval '1 hour';

  if v_recent >= 60 then
    raise exception 'That''s a lot of voting in one hour. Take a breather and try again shortly.'
      using errcode = 'BB429';
  end if;

  return new;
end;
$$;

drop trigger if exists rate_limit_photo_votes on public.photo_votes;
create trigger rate_limit_photo_votes
  before insert or update on public.photo_votes
  for each row
  execute function public.enforce_photo_vote_rate_limit();

-- ---------------------------------------------------------------------------
-- Part 3: promotion
-- ---------------------------------------------------------------------------
-- The winner is simply the most-voted URL (ties broken by earliest first
-- vote, so a tie can't flip-flop). The incumbent gets no bonus: if it has
-- votes it's in the tally like everything else, and if it has none it loses
-- to the first vote cast — which is exactly "whichever photo gets the most
-- upvotes becomes the main photo".
--
-- Three cases once a winner differs from the current approved photo:
--   1. Winner is a URL the database knows (a gallery photo, or a community
--      listing's own image_url): upsert it into approved_photos. The gallery
--      row is deliberately NOT deleted (unlike the admin's
--      setGalleryPhotoAsMain) — the pages dedupe by URL anyway, and keeping
--      the row means the photo keeps its identity if it's ever voted back out.
--   2. Winner is a URL the database does NOT know: that's the curated seed
--      photo (build-time JSON, no row) winning back — delete the approved
--      override so the display ladder falls through to the seed. A junk URL
--      voted in through the API lands here too; the worst it can do is revert
--      a listing to its seed photo, never inject an image.
--   3. Either way, an outgoing approved URL that has no gallery row of its
--      own is demoted INTO the gallery first, so losing the vote never makes
--      a photo vanish from the page.

create or replace function public.promote_top_photo(p_team_slug text, p_bobblehead_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner text;
  v_current text;
  v_known boolean;
begin
  select image_url into v_winner
  from (
    select image_url, count(*) as votes, min(updated_at) as first_vote
    from public.photo_votes
    where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id
    group by image_url
    order by votes desc, first_vote asc, image_url asc
    limit 1
  ) tally;

  -- No votes at all (e.g. the last vote was retracted): leave the main photo
  -- wherever curation put it rather than guessing.
  if v_winner is null then
    return;
  end if;

  select image_url into v_current
  from public.approved_photos
  where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id;

  if v_current is not null and v_winner = v_current then
    return;
  end if;

  v_known :=
    exists (
      select 1 from public.bobblehead_gallery_photos
      where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id
        and image_url = v_winner
    )
    or exists (
      select 1 from public.community_bobbleheads
      where team_slug = p_team_slug and id = p_bobblehead_id
        and image_url = v_winner
    );

  -- A community listing's own image_url is already its default main when no
  -- approved row overrides it — "promoting" it with no incumbent is a no-op.
  if v_current is null and v_known
     and exists (
       select 1 from public.community_bobbleheads
       where team_slug = p_team_slug and id = p_bobblehead_id
         and image_url = v_winner
     )
  then
    return;
  end if;

  -- Demote the outgoing approved photo into the gallery if that row is its
  -- only home (case 3 above).
  if v_current is not null
     and not exists (
       select 1 from public.bobblehead_gallery_photos
       where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id
         and image_url = v_current
     )
     and not exists (
       select 1 from public.community_bobbleheads
       where team_slug = p_team_slug and id = p_bobblehead_id
         and image_url = v_current
     )
  then
    insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url)
    values (p_bobblehead_id, p_team_slug, v_current);
  end if;

  if v_known then
    insert into public.approved_photos (bobblehead_id, team_slug, image_url, updated_at)
    values (p_bobblehead_id, p_team_slug, v_winner, now())
    on conflict (team_slug, bobblehead_id) do update
      set image_url = excluded.image_url, updated_at = now();
  else
    delete from public.approved_photos
    where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Part 4: the RPCs the site calls
-- ---------------------------------------------------------------------------

create or replace function public.cast_photo_vote(
  p_team_slug text,
  p_bobblehead_id text,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := trim(coalesce(p_image_url, ''));
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  if coalesce(p_team_slug, '') = '' or length(p_team_slug) > 100
     or coalesce(p_bobblehead_id, '') = '' or length(p_bobblehead_id) > 200 then
    raise exception 'unknown listing';
  end if;

  -- The seed photo's URL exists only in build-time JSON, so a full allow-list
  -- check isn't possible here; the shape check plus the promotion rules above
  -- bound what an invented URL can ever do.
  if v_url !~ '^https?://' or length(v_url) > 2000 then
    raise exception 'That doesn''t look like one of this listing''s photos.';
  end if;

  insert into public.photo_votes (user_id, team_slug, bobblehead_id, image_url)
  values (auth.uid(), p_team_slug, p_bobblehead_id, v_url)
  on conflict (user_id, team_slug, bobblehead_id) do update
    set image_url = excluded.image_url, updated_at = now();

  perform public.promote_top_photo(p_team_slug, p_bobblehead_id);
end;
$$;

create or replace function public.retract_photo_vote(
  p_team_slug text,
  p_bobblehead_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  delete from public.photo_votes
  where user_id = auth.uid()
    and team_slug = p_team_slug and bobblehead_id = p_bobblehead_id;

  perform public.promote_top_photo(p_team_slug, p_bobblehead_id);
end;
$$;

-- Tallies are public (anyone browsing sees the counts); who voted is not.
-- my_vote piggybacks on the same read so the page needs one round trip.
create or replace function public.get_photo_votes(p_team_slug text, p_bobblehead_id text)
returns table (image_url text, votes int, my_vote boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    image_url,
    count(*)::int,
    coalesce(bool_or(user_id = auth.uid()), false)
  from public.photo_votes
  where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id
  group by image_url;
$$;

revoke all on function public.promote_top_photo(text, text) from public, anon, authenticated;
revoke all on function public.cast_photo_vote(text, text, text) from public, anon;
revoke all on function public.retract_photo_vote(text, text) from public, anon;
revoke all on function public.get_photo_votes(text, text) from public;

grant execute on function public.cast_photo_vote(text, text, text) to authenticated;
grant execute on function public.retract_photo_vote(text, text) to authenticated;
grant execute on function public.get_photo_votes(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Part 5: cleanup on listing deletion
-- ---------------------------------------------------------------------------
-- Recreated in full from schema.sql to add the photo_votes sweep, matching
-- how newer files recreate wants_email — the current version lives here. The
-- only change is the one delete near the bottom.

create or replace function public.admin_delete_bobblehead(
  p_team_slug text,
  p_bobblehead_id text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_edit_team(p_team_slug) then
    raise exception 'not authorized';
  end if;

  if p_source not in ('curated', 'community') then
    raise exception 'unknown source %', p_source;
  end if;

  if p_source = 'community' then
    delete from public.community_bobbleheads
      where id = p_bobblehead_id and team_slug = p_team_slug;

    if not found then
      raise exception 'bobblehead not found';
    end if;

    delete from public.bobblehead_overrides
      where team_slug = p_team_slug and bobblehead_id = p_bobblehead_id;
  else
    insert into public.bobblehead_overrides (team_slug, bobblehead_id, deleted, updated_by, updated_at)
    values (p_team_slug, p_bobblehead_id, true, auth.uid(), now())
    on conflict (team_slug, bobblehead_id) do update
      set deleted = true,
          updated_by = auth.uid(),
          updated_at = now();
  end if;

  delete from public.approved_photos
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.bobblehead_gallery_photos
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_collections
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_favorites
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.user_wants
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.listing_reports
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;
  delete from public.photo_votes
    where bobblehead_id = p_bobblehead_id and team_slug = p_team_slug;

  update public.submissions
    set status = 'rejected', reviewed_at = now()
    where target_bobblehead_id = p_bobblehead_id
      and team_slug = p_team_slug
      and status = 'pending';
end;
$$;

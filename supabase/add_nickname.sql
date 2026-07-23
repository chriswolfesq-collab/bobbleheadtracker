-- Adds a dedicated `nickname` field to bobbleheads, rendered on a second line
-- beneath the title (see components/BobbleheadTitle.tsx). Idempotent — safe to
-- run more than once. Paste into the Supabase SQL editor.
--
-- 1. Nickname columns on the three tables that carry bobblehead text fields.
--    Community listings and curated overrides store it directly; submissions
--    carry it from the public submit form through to approval.

alter table public.community_bobbleheads
  add column if not exists nickname text;

alter table public.bobblehead_overrides
  add column if not exists nickname text;

alter table public.submissions
  add column if not exists nickname text;

-- 2. Approving a new_bobblehead submission now copies its nickname into the
--    community_bobbleheads row. Recreate the function with the extra column.

create or replace function public.approve_submission(
  p_submission_id uuid,
  p_image_url text,
  p_curated_has_photo boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions%rowtype;
  v_has_existing_photo boolean;
  v_new_id text;
begin
  select * into v_submission
    from public.submissions
    where id = p_submission_id and status = 'pending'
    for update;

  if not found then
    raise exception 'submission not found or already reviewed';
  end if;

  -- Authorize against the submission's own team, so a rep can approve only
  -- their team's queue while an admin can approve any.
  if not public.can_edit_team(v_submission.team_slug) then
    raise exception 'not authorized';
  end if;

  if v_submission.kind = 'photo_for_existing' then
    if v_submission.target_bobblehead_id is null then
      raise exception 'missing target_bobblehead_id for photo_for_existing submission';
    end if;

    v_has_existing_photo := p_curated_has_photo
      or exists (
        select 1 from public.approved_photos ap
          where ap.bobblehead_id = v_submission.target_bobblehead_id
      )
      or exists (
        select 1 from public.community_bobbleheads cb
          where cb.id = v_submission.target_bobblehead_id and cb.image_url is not null
      );

    if v_has_existing_photo then
      insert into public.bobblehead_gallery_photos (bobblehead_id, team_slug, image_url, approved_by)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid());
    else
      insert into public.approved_photos (bobblehead_id, team_slug, image_url, approved_by, updated_at)
      values (v_submission.target_bobblehead_id, v_submission.team_slug, p_image_url, auth.uid(), now())
      on conflict (bobblehead_id) do update
        set image_url = excluded.image_url,
            approved_by = excluded.approved_by,
            updated_at = now();
    end if;

  elsif v_submission.kind = 'new_bobblehead' then
    v_new_id := 'community-' || v_submission.team_slug || '-' ||
      regexp_replace(lower(coalesce(v_submission.title, 'bobblehead')), '[^a-z0-9]+', '-', 'g') ||
      '-' || substr(v_submission.id::text, 1, 8);

    insert into public.community_bobbleheads (id, team_slug, title, nickname, year, date, image_url, approved_by, created_at)
    values (
      v_new_id,
      v_submission.team_slug,
      coalesce(v_submission.title, 'Untitled'),
      v_submission.nickname,
      coalesce(v_submission.year, 'Unknown'),
      coalesce(v_submission.date, 'N/A'),
      p_image_url,
      auth.uid(),
      now()
    );
  else
    raise exception 'unknown submission kind %', v_submission.kind;
  end if;

  update public.submissions
    set status = 'approved', reviewed_at = now()
    where id = p_submission_id;
end;
$$;

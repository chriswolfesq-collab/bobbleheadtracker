-- Team rep welcome email.
-- Run once in the Supabase SQL editor after team_reps.sql; safe to re-run.
--
-- When someone is made a team rep, email them a short welcome that explains
-- their new, team-scoped powers and how to use them (see the notify-team-rep
-- edge function). The mail goes out database-side from an AFTER INSERT trigger
-- on team_reps — the same pattern as notify-new-submission and
-- notify-wishlist-owner — so every assignment path is covered without the app
-- needing to remember to send anything.
--
-- Volume: exactly one email per genuinely new (email, team_slug) row.
-- admin_assign_team_rep inserts with `on conflict do nothing`, so re-assigning
-- someone who is already that team's rep inserts no row and fires no trigger —
-- no duplicate welcome. A person made rep of a second team gets one welcome for
-- that team, which is the intent.

-- pg_net is enabled by default on Supabase; kept here so this file stands alone.
create extension if not exists pg_net with schema extensions;

-- The x-webhook-secret header reads from Vault via public.webhook_secret()
-- rather than carrying a literal. Run webhook_secret.sql once before this
-- file; there is nothing to substitute here any more. See that file for why:
-- the hand-substitution this replaces is what left every mailer silently broken.

create or replace function public.notify_new_team_rep()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Honor a master opt-out (see supabase/email_preferences.sql). Checked by
  -- address because team_reps is keyed by email and may name someone who hasn't
  -- signed up yet — no account means no preference on record, so the welcome
  -- still goes out, which is exactly when it's most useful.
  if not public.wants_email_by_address(new.email, 'all') then
    return new;
  end if;

  -- The row already holds everything the mailer needs: the rep's email and the
  -- team they now oversee. Nothing sensitive to resolve, so this just forwards.
  perform net.http_post(
    url := 'https://mawwzvnlihhsagatmolq.supabase.co/functions/v1/notify-team-rep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', public.webhook_secret()
    ),
    body := jsonb_build_object(
      'email', new.email,
      'team_slug', new.team_slug
    )
  );

  return new;
end;
$$;

drop trigger if exists on_team_rep_added on public.team_reps;
create trigger on_team_rep_added
  after insert on public.team_reps
  for each row
  execute function public.notify_new_team_rep();

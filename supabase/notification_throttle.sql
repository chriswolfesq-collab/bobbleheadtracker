-- Cooldown for the per-row admin notifiers. Run once in the Supabase SQL
-- editor (or via the CLI) BEFORE re-running webhook_trigger.sql and the
-- inbound_messages.sql notifier, which call the function this creates.
-- Safe to re-run.
--
-- Why: notify_new_submission / notify_new_report / notify_inbound_message all
-- fire once per inserted row. With a handful of trusted reps that's a useful
-- signal; with the public in, one burst (or one hostile account working under
-- the insert rate limits) is dozens of emails — inbox flood, and worse, it
-- burns the Resend quota that signup confirmations also draw from, and signup
-- email fails silently when the quota runs out.
--
-- The shape: each notifier kind has one row here, and a notifier only sends if
-- it can claim the slot — i.e. the last send for that kind is older than the
-- cooldown. During a burst the FIRST row emails and the rest stay quiet; the
-- admin queue pages remain the complete record, the email is just the nudge to
-- go look. A quiet-period send still goes out immediately, so nothing gets
-- slower when traffic is normal.

create table if not exists public.notification_throttle (
  kind text primary key,
  last_sent_at timestamptz not null
);

-- RLS on with no policies: nothing reads or writes this table except the
-- SECURITY DEFINER notifiers, which run as the table owner and bypass RLS.
alter table public.notification_throttle enable row level security;

-- Atomically claim the right to send: true means "you're the first since the
-- cooldown started — go ahead", false means a send already went out recently.
-- The ON CONFLICT row lock serializes concurrent inserts, so two rows landing
-- in the same instant can't both claim the slot.
create or replace function public.claim_notification_slot(p_kind text, p_cooldown interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_throttle as t (kind, last_sent_at)
  values (p_kind, now())
  on conflict (kind) do update
    set last_sent_at = now()
    where t.last_sent_at < now() - p_cooldown;

  return found;
end;
$$;

revoke all on function public.claim_notification_slot(text, interval) from public, anon, authenticated;

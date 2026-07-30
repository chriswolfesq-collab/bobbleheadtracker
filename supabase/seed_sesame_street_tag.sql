-- Applies the "Sesame Street" tag: 9 curated listings plus 2 community
-- submissions.
--
-- This is the tag the widened key was written for. elmo-2023 is the same id in
-- five different team files -- Blue Jays, Cardinals, Giants, Mariners and Reds
-- all ran an Elmo giveaway in 2023 -- and under the old
-- (bobblehead_id, tag_slug) key, four of those five would have been swallowed
-- by `on conflict do nothing` without an error. Run
-- supabase/fix_bobblehead_tags_pk.sql first if it hasn't been.
--
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Judgment calls: Fredbird & Big Bird is in -- half a Cardinals mascot is
-- still Big Bird. Bert Blyleven, Bert Campaneris, Ernie Banks, Ernie Whitt and
-- Ernie Lombardi are all out; they are people, not puppets. So is Delmon
-- Young, who matches a naive search for "elmo" in the middle of his name.

insert into public.tags (slug, label)
values ('sesame-street', 'Sesame Street')
on conflict (slug) do nothing;

insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'sesame-street'
from (
  values
    -- Elmo, 2023: one giveaway id, five teams. The whole reason team_slug is
    -- in the key.
    ('elmo-2023', 'blue-jays'),
    ('elmo-2023', 'cardinals'),
    ('elmo-2023', 'giants'),
    ('elmo-2023', 'mariners'),
    ('elmo-2023', 'reds'),
    ('elmo-2022', 'brewers'),

    ('cookie-monster-2023', 'brewers'),

    ('big-bird-twins-2022', 'twins'),
    ('fredbird-big-bird-2022', 'cardinals'),

    -- Community submissions: database rows, not entries in data/giveaways.
    ('community-cubs-elmo-815dbd93', 'cubs'),
    ('community-cubs-cookie-monster-77d3e6cd', 'cubs')
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What landed. Expect 11 -- and if it says 7, the key migration hasn't run.
select listing_count from public.tag_counts where slug = 'sesame-street';

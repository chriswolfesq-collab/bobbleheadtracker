-- Applies the "Hello Kitty" and "Sugar Skull" tags: 41 listings across the two.
--
-- Both were seeded into the vocabulary with nothing carrying them; these are
-- the listings that were already in the catalog waiting. Five bobblehead ids
-- here are shared between teams -- hello-kitty-2015, -2019 and -2022, plus
-- sugar-skull-2018 and -2022 -- so this needs the widened key from
-- supabase/fix_bobblehead_tags_pk.sql. Without it, five of these rows go
-- missing without an error.
--
-- Idempotent. Paste into the Supabase SQL editor.
--
-- Scope note: the sweep also turned up Día de Los Dodgers (five years), Dia de
-- los Gigantes, Dia de Los Bravos, the White Sox' La Catrina and a community
-- Dia De Los Muertos. Those are the dia-de-los-muertos tag, not these two, and
-- are left alone here. Whether every sugar skull should also carry Día de los
-- Muertos is a real question -- the iconography is the same holiday -- but
-- it's a call worth making deliberately rather than as a side effect.

insert into public.tags (slug, label)
values ('hello-kitty', 'Hello Kitty')
on conflict (slug) do nothing;

-- Hello Kitty: Sanrio's cat, and the most-run promotion in the catalog after bobbleheads of actual players.
-- 22 curated + 2 community = 24.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'hello-kitty'
from (
  values
    ('hello-kitty-special-ticket-2024', 'astros'),                          -- Hello Kitty (Special Ticket), 2024
    ('hello-kitty-special-ticket-2023', 'astros'),                          -- Hello Kitty (Special Ticket), 2023
    ('hello-kitty-add-on-2022', 'astros'),                                  -- Hello Kitty (Add on), 2022
    ('hello-kitty-2016', 'athletics'),                                      -- Hello Kitty, 2016
    ('hello-kitty-2015', 'athletics'),                                      -- Hello Kitty, 2015
    ('hello-kitty-2022', 'blue-jays'),                                      -- Hello Kitty, 2022
    ('hello-kitty-2018', 'cardinals'),                                      -- Hello Kitty, 2018
    ('hello-kitty-2025', 'diamondbacks'),                                   -- Hello Kitty, 2025
    ('dbacks-hello-kitty-2015', 'diamondbacks'),                            -- D-backs Hello Kitty, 2015
    ('hello-kitty-2023', 'dodgers'),                                        -- Hello Kitty, 2023
    ('hello-kitty-mini-2014', 'dodgers'),                                   -- Hello Kitty Mini, 2014
    ('hello-kitty-mini-2013', 'dodgers'),                                   -- Hello Kitty Mini, 2013
    ('hello-kitty-mini-dodger-stadium-50th-anniversary-2012', 'dodgers'),   -- Hello Kitty Mini Dodger Stadium 50th Anniversary, 2012
    ('hello-kitty-2019', 'giants'),                                         -- Hello Kitty, 2019
    ('hello-kitty-2015', 'giants'),                                         -- Hello Kitty, 2015
    ('hello-kitty-2024', 'mets'),                                           -- Hello Kitty, 2024
    ('hello-kitty-city-connect-2025', 'nationals'),                         -- Hello Kitty (City Connect), 2025
    ('hello-kitty-red-2025', 'nationals'),                                  -- Hello Kitty (Red), 2025
    ('hello-kitty-2022', 'padres'),                                         -- Hello Kitty, 2022
    ('hello-kitty-2019', 'padres'),                                         -- Hello Kitty, 2019
    ('hello-kitty-2026', 'yankees'),                                        -- Hello Kitty, 2026
    ('yankees-hello-kitty-2014', 'yankees'),                                -- Yankees Hello Kitty, 2014
    ('community-padres-hello-kitty-c2d3b83d', 'padres'),                    -- Hello Kitty (Pinstripes Hello Kitty) [community]
    ('community-athletics-hello-kitty--51b5bf2f', 'athletics')              -- Hello Kitty [community]
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('sugar-skull', 'Sugar Skull')
on conflict (slug) do nothing;

-- Sugar Skull: The calavera giveaways, most of them Día de los Muertos nights.
-- 11 curated + 6 community = 17.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'sugar-skull'
from (
  values
    ('sugar-skull-2025', 'astros'),                             -- Sugar Skull, 2025
    ('sugarskull-2024', 'astros'),                              -- Sugarskull, 2024
    ('sugar-skull-2023', 'astros'),                             -- Sugar Skull, 2023
    ('sugar-skull-2022', 'astros'),                             -- Sugar Skull, 2022
    ('sugar-skull-2018', 'athletics'),                          -- Sugar Skull, 2018
    ('cerveceros-sugar-skull-2019', 'brewers'),                 -- Cerveceros Sugar Skull, 2019
    ('sugar-skull-2018', 'brewers'),                            -- Sugar Skull, 2018
    ('sugar-skull-2022', 'cardinals'),                          -- Sugar Skull, 2022
    ('sugar-skull-2017', 'diamondbacks'),                       -- Sugar Skull, 2017
    ('sugar-skull-2024', 'twins'),                              -- Sugar Skull, 2024
    ('sugar-skull-2021', 'white-sox'),                          -- Sugar Skull, 2021
    ('community-padres-sugar-skull--9417763a', 'padres'),       -- Sugar Skull (Blue Sugar Skull) [community]
    ('community-padres-sugar-skull-add6c923', 'padres'),        -- Sugar Skull (City Connect 1) [community]
    ('community-padres-sugar-skull-ab6d2a69', 'padres'),        -- Sugar Skull (Mariachi) [community]
    ('community-astros-orbit-sugarskull-f1b23cc4', 'astros'),   -- Orbit (Sugarskull) [community]
    ('community-cubs-sugar-skull-144f6b7c', 'cubs'),            -- Sugar Skull [community]
    ('community-cubs-sugar-skull-f568737c', 'cubs')             -- Sugar Skull [community]
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What landed. Expect Hello Kitty 24 and Sugar Skull 17. Short counts mean the
-- key migration hasn't run: 21 and 15 are what the old key would leave.
select slug, label, listing_count
from public.tag_counts
where slug in ('hello-kitty', 'sugar-skull');

-- Site-wide tagging pass, part 6 of 6: Licensed themes and crossovers.
--
-- A sweep of the whole catalog -- 3,778 live listings, curated and community --
-- against the 68 tags now in the vocabulary. Same rule as every pass before it:
-- a listing is tagged because its own title or nickname says so, not because
-- someone judged that it qualified. Where a tag has no keyword -- Celebrity,
-- Announcers/Broadcasters, Manager, Mascot -- it stays discovery-based and the
-- note on the tag says what was read in and what was left out.
--
-- Idempotent. Needs the widened key from supabase/fix_bobblehead_tags_pk.sql.
-- Paste into the Supabase SQL editor, or run with
--   npx supabase db query --file <this file> --linked


-- -------------------------------------------------------------------------
-- star-wars -- 5 listings.
-- Wordplay, which is how the tag was already applied -- "Orlando Calrissian"
-- and "Yuli Wan" set the precedent. Two Sky Walkers, a Sky-Wacha, a
-- Mondi-Lorian and an Obi Juan.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'star-wars'
from (
  values
    ('taijuan-walker-sky-walker-2016'                     , 'mariners'      ),  -- Taijuan Walker ("Sky Walker")
    ('christian-walker-sky-walker-2021'                   , 'diamondbacks'  ),  -- Christian Walker (Sky-Walker)
    ('community-royals-michael-wacha-sky-wacha-7e836b57'  , 'royals'        ),  -- Michael Wacha (Sky-Wacha)
    ('mondi-lorian-2021'                                  , 'royals'        ),  -- Adalberto Mondesi (Mondi-Lorian)
    ('community-padres-juan-soto-fc535e71'                , 'padres'        )  -- Juan Soto (Obi Juan)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- marvel -- 6 listings.
-- Stan Lee, Shang-Chi, three Rocket Raccoons and the Brewers' Gauntlet.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'marvel'
from (
  values
    ('stan-lee-2015'        , 'giants'        ),  -- Stan Lee
    ('shang-chi-2021'       , 'giants'        ),  -- Shang-Chi
    ('rocket-raccoon-2017'  , 'giants'        ),  -- Rocket Raccoon
    ('rocket-raccoon-2017'  , 'reds'          ),  -- Rocket Raccoon
    ('rocket-raccoon-2017'  , 'twins'         ),  -- Rocket Raccoon
    ('gauntlet-2018'        , 'brewers'       )  -- "Gauntlet"
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- game-of-thrones -- 5 listings.
-- House wordplay, as House Banister and House Yost already are.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'game-of-thrones'
from (
  values
    ('house-bochy-2019'                  , 'giants'        ),  -- House Bochy (Game of Thrones)
    ('house-of-pence-hunter-pence-2017'  , 'giants'        ),  -- "House Of Pence" (Hunter Pence)
    ('ozzie-of-house-smiths-2018'        , 'cardinals'     ),  -- "Ozzie of House Smith's"
    ('house-gardy-2019'                  , 'tigers'        ),  -- "House Gardy" (Ron Gardenhire)
    ('house-random-bobblehead-2026'      , 'yankees'       )  -- "House" (Random) Bobblehead
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- peanuts -- 1 listings.
-- Peppermint Patty.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'peanuts'
from (
  values
    ('peppermint-patty-2023'  , 'phillies'      )  -- Peppermint Patty
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- disney -- 2 listings.
-- Two Woodys -- the Funko POP and Kirk Rueter's Pixar Day talking one.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'disney'
from (
  values
    ('woody-funko-pop-2014'              , 'giants'        ),  -- Woody (Funko POP!)
    ('kirk-rueter-woody-luxo-ball-2019'  , 'giants'        )  -- Kirk Woody Rueter  (Pixar Day Talking Woody)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- the-sandlot -- 6 listings.
-- The rest of the 2018 Ham Porter run, the Cardinals' Ham/Squints dual and
-- their Sandlot, plus the Brewers' Great Hambino.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'the-sandlot'
from (
  values
    ('sandlot-2019'                , 'cardinals'     ),  -- Sandlot
    ('cardinals-ham-squints-2018'  , 'cardinals'     ),  -- Cardinals Ham / Squints
    ('ham-porter-2018'             , 'nationals'     ),  -- Ham Porter
    ('ham-porter-2018'             , 'braves'        ),  -- "Ham" Porter
    ('ham-porter-2018'             , 'phillies'      ),  -- "Ham" Porter
    ('great-hambino-2018'          , 'brewers'       )  -- "Great Hambino"
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- grateful-dead -- 10 listings.
-- Every Jerry Garcia in the catalog, the dancing bears, the skeleton and a
-- Grateful Dead Uncle Sam.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'grateful-dead'
from (
  values
    ('grateful-dead-bear-2017'                         , 'giants'        ),  -- Grateful Dead Bear
    ('jerry-garcia-2012'                               , 'giants'        ),  -- Jerry Garcia
    ('jerry-garcias-grateful-dead-dancing-bears-2011'  , 'giants'        ),  -- Jerry Garcia's Grateful Dead Dancing Bears
    ('jerry-garcia-2010'                               , 'giants'        ),  -- Jerry Garcia
    ('jerry-garcia-2023'                               , 'reds'          ),  -- Jerry Garcia
    ('grateful-dead-skeleton-2018'                     , 'reds'          ),  -- Grateful Dead Skeleton
    ('grateful-dead-dancing-bears-2016'                , 'reds'          ),  -- Grateful Dead Dancing Bears
    ('uncle-sam-2022'                                  , 'white-sox'     ),  -- Uncle Sam (Grateful Dead)
    ('jerry-garcia-2023'                               , 'yankees'       ),  -- Jerry Garcia
    ('jerry-garcia-2022'                               , 'yankees'       )  -- Jerry Garcia
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- scooby-doo -- 4 listings.
-- The other four Scooby-Doos in the catalog.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'scooby-doo'
from (
  values
    ('scooby-doo-2019'  , 'brewers'       ),  -- Scooby-Doo
    ('scooby-doo-2021'  , 'phillies'      ),  -- Scooby-Doo
    ('scooby-doo-2022'  , 'yankees'       ),  -- Scooby-Doo
    ('scooby-doo-2021'  , 'yankees'       )  -- Scooby-Doo
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- ghostbusters -- 2 listings.
-- The Brewers' quad and DJ LeMahieu.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'ghostbusters'
from (
  values
    ('ghostbusters-quad-2016'         , 'brewers'       ),  -- Ghostbusters (Quad)
    ('dj-lemahieu-ghostbusters-2016'  , 'rockies'       )  -- DJ LeMahieu (Ghostbusters)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- wwe -- 4 listings.
-- The four WWE nights.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'wwe'
from (
  values
    ('bob-uecker-wwe-2021'             , 'brewers'       ),  -- Bob Uecker (WWE)
    ('al-hrabosky-wwe-2023'            , 'cardinals'     ),  -- Al Hrabosky (WWE)
    ('todd-frazier-wwe-day-2019'       , 'mets'          ),  -- Todd Frazier (WWE Day)
    ('dustin-pedroia-wwe-themed-2018'  , 'red-sox'       )  -- Dustin Pedroia (WWE Themed)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- harry-potter -- 1 listings.
-- Evan Carter's.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'harry-potter'
from (
  values
    ('community-rangers-evan-carter-0654f0b9'  , 'rangers'       )  -- Evan Carter (Harry Potter)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- nintendo -- 1 listings.
-- Julio Rodriguez's Mario power-up.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'nintendo'
from (
  values
    ('community-mariners-julio-rodriguez-390b085d'  , 'mariners'      )  -- Julio Rodriguez (Mario Powerup)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- field-of-dreams -- 1 listings.
-- Tim Anderson's walk-off at the Field of Dreams game.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'field-of-dreams'
from (
  values
    ('tim-anderson-2022'  , 'white-sox'     )  -- Tim Anderson (Field of Dreams Walkoff Homer)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- backyard-sports -- 2 listings.
-- Two more Pablo Sanchez.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'backyard-sports'
from (
  values
    ('community-rangers-pablo-sanchez-84ba05c0'    , 'rangers'       ),  -- Pablo Sanchez (Backyard Baseball Bobblehead)
    ('community-white-sox-pablo-sanchez-2d94d864'  , 'white-sox'     )  -- Pablo Sanchez (Backyard Baseball)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   star-wars: +5
--   marvel: +6
--   game-of-thrones: +5
--   peanuts: +1
--   disney: +2
--   the-sandlot: +6
--   grateful-dead: +10
--   scooby-doo: +4
--   ghostbusters: +2
--   wwe: +4
--   harry-potter: +1
--   nintendo: +1
--   field-of-dreams: +1
--   backyard-sports: +2

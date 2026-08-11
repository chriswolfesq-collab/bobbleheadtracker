-- Site-wide tagging pass, part 1 of 6: Formats and physical variants.
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
-- bobble-counter -- 18 listings.
-- The ones with a working counter on the base: K-counters, hit counters, home
-- run counters, the Giants' save and splash-hit counters, the Rangers'
-- dot-race results.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'bobble-counter'
from (
  values
    ('justin-verlander-k-counter-2018'         , 'astros'        ),  -- Justin Verlander (K-Counter)
    ('jose-altuve-hit-counter-2015'            , 'astros'        ),  -- Jose Altuve (Hit Counter)
    ('robbie-ray-strikeout-counter-2017'       , 'diamondbacks'  ),  -- Robbie Ray (Strikeout Counter)
    ('camilo-doval-2024'                       , 'giants'        ),  -- Camilo Doval (Save Counter)
    ('lou-seal-splash-hits-counter-2023'       , 'giants'        ),  -- Lou Seal (Splash Hits Counter)
    ('ichiro-suzuki-2011'                      , 'mariners'      ),  -- Ichiro Suzuki (Hit Counter)
    ('ichiro-suzuki-hit-counter-2016'          , 'marlins'       ),  -- Ichiro Suzuki (Hit-Counter)
    ('max-scherzer-strikeout-counter-2022'     , 'mets'          ),  -- Max Scherzer (Strikeout Counter)
    ('jacob-degrom-strikeout-counter-2022'     , 'mets'          ),  -- Jacob deGrom (Strikeout Counter)
    ('adrian-beltre-home-run-counter-2018'     , 'rangers'       ),  -- Adrian Beltre (Home Run Counter)
    ('yu-darvish-k-counter-blue-variant-2013'  , 'rangers'       ),  -- Yu Darvish (K-Counter - Blue Variant)
    ('yu-darvish-k-counter-red-variant-2013'   , 'rangers'       ),  -- Yu Darvish (K-Counter - Red Variant)
    ('dot-race-results-2026'                   , 'rangers'       ),  -- Red Dot/Blue Dot/Green Dot (Dot Race Results Counter)
    ('chris-archer-k-counter-2016'             , 'rays'          ),  -- Chris Archer (K-Counter)
    ('jd-martinez-home-run-counter-2019'       , 'red-sox'       ),  -- J.D. Martinez (Home Run Counter)
    ('chris-sale-k-counter-2018'               , 'red-sox'       ),  -- Chris Sale ("K-Counter")
    ('whit-merrifield-hit-counter-2021'        , 'royals'        ),  -- Whit Merrifield ("Hit Counter")
    ('chris-sale-k-counter-2016'               , 'white-sox'     )  -- Chris Sale (K-Counter)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- audio -- 4 listings.
-- Four more that make noise: two talking broadcasters, a talking Woody, a
-- sound chip.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'audio'
from (
  values
    ('kirk-rueter-woody-luxo-ball-2019'         , 'giants'        ),  -- Kirk Woody Rueter  (Pixar Day Talking Woody)
    ('don-orsillo-mark-grant-don-and-mud-2023'  , 'padres'        ),  -- Don Orsillo & Mark Grant (Talking Don & Mud)
    ('rusty-kuntz-2017'                         , 'royals'        ),  -- Rusty Kuntz (Talking)
    ('community-giants-kruk-kuip-913493da'      , 'giants'        )  -- Kruk & Kuip (Sound Chip Mail Promo)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- light-up -- 2 listings.
-- Mr. Met's Unisphere and a light-up Hello Kitty.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'light-up'
from (
  values
    ('mr-met-unisphere-light-up-2026'           , 'mets'          ),  -- Mr. Met (Unisphere Light-Up)
    ('community-mariners-hello-kitty-826ef046'  , 'mariners'      )  -- Hello Kitty (Light Up Bobble Arm)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- bobble-arms -- 2 listings.
-- John Adams' bobble arm and the Hello Kitty that has one.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'bobble-arms'
from (
  values
    ('john-adams-bobble-arm-2006'               , 'guardians'     ),  -- John Adams Bobble Arm
    ('community-mariners-hello-kitty-826ef046'  , 'mariners'      )  -- Hello Kitty (Light Up Bobble Arm)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- bobble-legs -- 1 listings.
-- Chandler Simpson's.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'bobble-legs'
from (
  values
    ('community-rays-chandler-simpson-dff122bd'  , 'rays'          )  -- Chandler Simpson (Bobblelegs)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- set -- 1 listings.
-- The Twins' Hrbek/Puckett Legends set of two.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'set'
from (
  values
    ('kent-hrbek-kirby-puckett-legends-set-of-2-2011'  , 'twins'         )  -- Kent Hrbek & Kirby Puckett ("Legends" Set of 2)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- limited-edition -- 1 listings.
-- Kirk Gibson's numbered gold, 1 of 350.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'limited-edition'
from (
  values
    ('kirk-gibson-gold-limited-edition-1-of-350-2018'  , 'dodgers'       )  -- Kirk Gibson (Gold Limited Edition)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- gold -- 2 listings.
-- Gold as a finish, not as a Gold Glove: the Phillies' gold base variant and
-- the golden Arenado gnome.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'gold'
from (
  values
    ('vintage-phillies-gold-base-variant-2015'  , 'phillies'      ),  -- Vintage Phillies (Gold Base Variant)
    ('golden-arenado-gnome-2014'                , 'rockies'       )  -- Golden Arenado Bobblehead Gnome
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- retro -- 7 listings.
-- Retro and throwback treatments. "Vintage" listings are deliberately left out
-- -- that is a different series naming, not a stated retro theme.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'retro'
from (
  values
    ('mike-trout-throwback-2024'                    , 'angels'        ),  -- Mike Trout (Throwback)
    ('clayton-kershaw-60th-anniversary-retro-2018'  , 'dodgers'       ),  -- Clayton Kershaw (60th Anniversary Retro)
    ('andre-ethier-brooklyn-throwback-2011'         , 'dodgers'       ),  -- Andre Ethier (Brooklyn Throwback)
    ('giants-retro-2017'                            , 'giants'        ),  -- Giants Retro
    ('retro-ceramic-2026'                           , 'rangers'       ),  -- Retro Ceramic
    ('evan-longoria-retro-2013'                     , 'rays'          ),  -- Evan Longoria (Retro)
    ('tigers-retro-style-2016'                      , 'tigers'        )  -- Tigers (Retro-Style)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   bobble-counter: +18
--   audio: +4
--   light-up: +2
--   bobble-arms: +2
--   bobble-legs: +1
--   set: +1
--   limited-edition: +1
--   gold: +2
--   retro: +7

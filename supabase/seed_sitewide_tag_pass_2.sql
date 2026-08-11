-- Site-wide tagging pass, part 2 of 6: Promotions and programmes.
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
-- city-connect -- 24 listings.
-- Every listing whose own title says City Connect. The tag existed with six;
-- the uniform has had a giveaway on most clubs since.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'city-connect'
from (
  values
    ('mike-trout-shohei-ohtani-city-connect-2023'    , 'angels'        ),  -- Mike Trout & Shohei Ohtani (City Connect)
    ('mike-trout-city-connect-2022'                  , 'angels'        ),  -- Mike Trout (City Connect)
    ('yordan-alvarez-city-connect-2025'              , 'astros'        ),  -- Yordan Alvarez (City Connect)
    ('jeremy-pena-city-connect-2025'                 , 'astros'        ),  -- Jeremy Pena (City Connect)
    ('hunter-brown-city-connect-2025'                , 'astros'        ),  -- Hunter Brown (City Connect)
    ('orbit-city-connect-2025'                       , 'astros'        ),  -- Orbit (City Connect)
    ('jose-altuve-city-connect-2025'                 , 'astros'        ),  -- Jose Altuve (City Connect)
    ('altuve-city-connect-2022'                      , 'astros'        ),  -- Jose Altuve (City Connect)
    ('hello-kitty-city-connect-2025'                 , 'nationals'     ),  -- Hello Kitty (City Connect)
    ('manny-machado-city-connect-2023'               , 'padres'        ),  -- Manny Machado (City Connect 1)
    ('jacob-degrom-city-connect-3-of-3-2023'         , 'rangers'       ),  -- Jacob deGrom (City Connect (3 of 3))
    ('corey-seager-city-connect-2-of-3-2023'         , 'rangers'       ),  -- Corey Seager (City Connect (2 of 3))
    ('marcus-semien-city-connect-1-of-3-2023'        , 'rangers'       ),  -- Marcus Semien (City Connect (1 of 3))
    ('jake-fraley-city-connect-2024'                 , 'reds'          ),  -- Jake Fraley (City Connect)
    ('matt-mclain-city-connect-2024'                 , 'reds'          ),  -- Matt McLain (City Connect)
    ('alexis-diaz-city-connect-2024'                 , 'reds'          ),  -- Alexis Diaz (City Connect)
    ('elly-de-la-cruz-city-connect-2024'             , 'reds'          ),  -- Elly De La Cruz (City Connect)
    ('graham-ashcraft-city-connect-2024'             , 'reds'          ),  -- Graham Ashcraft (City Connect)
    ('hunter-greene-city-connect-2024'               , 'reds'          ),  -- Hunter Greene (City Connect)
    ('big-bobby-city-connect-2026'                   , 'royals'        ),  -- Big Bobby Witt Jr. (City Connect Jersey)
    ('salvador-perez-city-connect-2026'              , 'royals'        ),  -- Salvador Perez (City Connect)
    ('community-padres-fernando-tatis-jr--b9ff5ffe'  , 'padres'        ),  -- Fernando Tatis, Jr. (City Connect 2)
    ('community-padres-sugar-skull-add6c923'         , 'padres'        ),  -- Sugar Skull (City Connect 1)
    ('community-rays-junior-caminero-306a49a7'       , 'rays'          )  -- Junior Caminero (City Connect)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- season-ticket-holders -- 24 listings.
-- Season-ticket exclusives named as such -- "Season Ticket Holders", "Season
-- Ticket", "STH Only", the Twins' Random Season Ticket run.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'season-ticket-holders'
from (
  values
    ('altuve-astro-for-life-sth-exclusive-2024'                                , 'astros'        ),  -- Jose Altuve (Astro for Life STH Exclusive)
    ('dave-stewart-2004-season-ticket-holders-2004'                            , 'athletics'     ),  -- Dave Stewart (2004 Season Ticket Holders)
    ('bill-king-with-sound-season-ticket-holders-2003'                         , 'athletics'     ),  -- Bill King (With Audio - Season Ticket Holders)
    ('vernon-wells-spring-training-season-ticket-2007'                         , 'blue-jays'     ),  -- Vernon Wells (Spring Training Season Ticket)
    ('charlie-hough-season-ticket-holders-2018'                                , 'marlins'       ),  -- Charlie Hough (The First Pitch/Season Ticket Holders)
    ('noah-syndergaard-season-ticket-holders-2018'                             , 'mets'          ),  -- Noah Syndergaard (Season Ticket Holders)
    ('mackenzie-gore-sth-only-2025'                                            , 'nationals'     ),  -- MacKenzie Gore (STH Only)
    ('lane-thomas-sth-only-2024'                                               , 'nationals'     ),  -- Lane Thomas (STH Only)
    ('josiah-gray-sth-only-2023'                                               , 'nationals'     ),  -- Josiah Gray (STH Only)
    ('cal-ripken-jr-season-ticket-2007'                                        , 'orioles'       ),  -- Cal Ripken Jr. (Season Ticket)
    ('jake-bauers-willy-adames-double-season-ticket-holders-2019'              , 'rays'          ),  -- Jake Bauers & Willy Adames (Double, Season Ticket Holders)
    ('blake-snell-season-ticket-holders-2019'                                  , 'rays'          ),  -- Blake Snell (Season Ticket Holders)
    ('random-season-ticket-2010-3-30'                                          , 'twins'         ),  -- Random Season Ticket
    ('random-season-ticket-2010-3-16'                                          , 'twins'         ),  -- Random Season Ticket
    ('random-season-ticket-2009'                                               , 'twins'         ),  -- Random Season Ticket
    ('earl-battey-season-ticket-2007'                                          , 'twins'         ),  -- Earl Battey (Season Ticket)
    ('zoilo-versalles-season-ticket-2007'                                      , 'twins'         ),  -- Zoilo Versalles (Season Ticket)
    ('harmon-killebrew-sth-red-variant-2006'                                   , 'twins'         ),  -- Harmon Killebrew (STH Red Variant)
    ('brad-radke-torii-hunter-corey-koskie-ron-gardenhire-season-ticket-2004'  , 'twins'         ),  -- Brad Radke, Torii Hunter, Corey Koskie & Ron Gardenhire (Season Ticket)
    ('aj-pierzynski-2008'                                                      , 'white-sox'     ),  -- A.J. Pierzynski (Season Ticket Holder Exclusive)
    ('community-cubs-london-starters-e0cd7a4d'                                 , 'cubs'          ),  -- London Starters (2020 Season Ticket Holders)
    ('community-cubs-yu-darvish-bafdd8aa'                                      , 'cubs'          ),  -- Yu Darvish (2020 Season Ticket Holders)
    ('community-marlins-giancarlo-stanton-season-ticket-holders--2d0c2754'     , 'marlins'       ),  -- Giancarlo Stanton (Season Ticket Holders)
    ('community-white-sox-jake-peavy-season-ticket-holder-exclusive-e05de8a7'  , 'white-sox'     )  -- Jake Peavy Season Ticket Holder Exclusive
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- alumni -- 2 listings.
-- The Rangers' two alumni listings.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'alumni'
from (
  values
    ('ferguson-jenkins-alumni-2007'  , 'rangers'       ),  -- Ferguson Jenkins (70's Alumni Legacy)
    ('jim-sundberg-alumni-2006'      , 'rangers'       )  -- Jim Sundberg (Alumni)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   city-connect: +24
--   season-ticket-holders: +24
--   alumni: +2

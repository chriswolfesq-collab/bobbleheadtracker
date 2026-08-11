-- Site-wide tagging pass, part 5 of 6: Mascots, animals and counts.
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
-- mascot -- 26 listings.
-- Mascots the name sweep missed: Mrs. Met, the full Racing Presidents field,
-- the Pirates' remaining pierogies, the Royals' condiment race, Mr. Red, King
-- Redlegs, Queen Rosie, the San Diego Chicken, the Brewers' Racing Hot Dog and
-- a visiting Tommy Hawk.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'mascot'
from (
  values
    ('mrs-met-taxicab-2025'                     , 'mets'          ),  -- Mrs. Met (Taxicab)
    ('mrs-met-gives-back-2025'                  , 'mets'          ),  -- Mrs. Met (Gives Back)
    ('mrs-met-wonder-woman-2021'                , 'mets'          ),  -- Mrs. Met (Wonder Woman)
    ('racing-presidents-george-tom-2023'        , 'nationals'     ),  -- Racing Presidents (George & Tom)
    ('racing-presidents-teddy-abe-2023'         , 'nationals'     ),  -- Racing Presidents (Teddy & Abe)
    ('teddy-roosevelt-garden-gnome-2018'        , 'nationals'     ),  -- Teddy Roosevelt (Garden Gnome, MLB Futures Game)
    ('herbert-hoover-racing-president-2016'     , 'nationals'     ),  -- Herbert Hoover (Racing President)
    ('calvin-coolidge-racing-president-2015'    , 'nationals'     ),  -- Calvin Coolidge (Racing President)
    ('bill-racing-president-2014'               , 'nationals'     ),  -- "Bill" (Racing President)
    ('teddy-roosevelt-racing-president-2007'    , 'nationals'     ),  -- Teddy Roosevelt (Racing President)
    ('abe-lincoln-racing-president-2007'        , 'nationals'     ),  -- Abe Lincoln (Racing President)
    ('thomas-jefferson-racing-president-2007'   , 'nationals'     ),  -- Thomas Jefferson (Racing President)
    ('george-washington-racing-president-2007'  , 'nationals'     ),  -- George Washington (Racing President)
    ('san-diego-chicken-2019'                   , 'padres'        ),  -- San Diego Chicken (50th Anniversary)
    ('jalapeno-hannah-mini-2004'                , 'pirates'       ),  -- "Jalapeno Hannah" (Mini)
    ('sauerkraut-saul-mini-2004'                , 'pirates'       ),  -- "Sauerkraut Saul" (Mini)
    ('racing-hot-dog-2011'                      , 'brewers'       ),  -- Racing Hot Dog
    ('mr-red-race-car-2025'                     , 'reds'          ),  -- Mr. Red (Race Car)
    ('mr-red-bobblehead-frame-2013'             , 'reds'          ),  -- Mr. Red (Bobblehead Frame)
    ('king-redlegs-2018'                        , 'reds'          ),  -- King Redlegs
    ('queen-rosie-2019'                         , 'reds'          ),  -- Queen Rosie
    ('relish-2013'                              , 'royals'        ),  -- Relish
    ('mustard-2013'                             , 'royals'        ),  -- Mustard
    ('ketchup-2013'                             , 'royals'        ),  -- Ketchup
    ('mr-royal-2014'                            , 'royals'        ),  -- "Mr. Royal"
    ('tommy-hawk-blackhawks-night-2018'         , 'white-sox'     )  -- Tommy Hawk (Blackhawks Night)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- animals -- 18 listings.
-- Animals actually depicted, mascots still excluded: the Cincinnati Zoo's
-- Fiona and Mavis, a hippo, a lizard, a shark, a flying pig, an eagle, an
-- elephant, two pigeons, a caterpillar, a parrot, Zim Bear, the Care Bears,
-- Danny Duffy's dog Sadie and three from the padres' zoo series.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'animals'
from (
  values
    ('care-bears-2026'                            , 'astros'        ),  -- Care Bears
    ('parrot-2016'                                , 'giants'        ),  -- Parrot
    ('zim-bear-don-zimmer-2023'                   , 'rays'          ),  -- "Zim Bear" (Don Zimmer)
    ('the-very-hungry-caterpillar-2018'           , 'rangers'       ),  -- The Very Hungry Caterpillar
    ('mai-thai-the-elephant-2022'                 , 'reds'          ),  -- Mai Thai the Elephant
    ('sam-the-bald-eagle-2019'                    , 'reds'          ),  -- Sam the Bald Eagle
    ('flying-pig-2018'                            , 'reds'          ),  -- Flying Pig
    ('shark-2018'                                 , 'reds'          ),  -- Shark
    ('fiona-2018'                                 , 'reds'          ),  -- Fiona
    ('mavis-2018'                                 , 'reds'          ),  -- Mavis
    ('hippo-2023'                                 , 'reds'          ),  -- Hippo
    ('lizard-2019'                                , 'reds'          ),  -- Lizard
    ('danny-duffy-player-designed-2019'           , 'royals'        ),  -- Danny Duffy And Sadie (Player Designed)
    ('community-royals-the-pigeon-91382995'       , 'royals'        ),  -- The Pigeon
    ('the-pigeon-2024'                            , 'yankees'       ),  -- The Pigeon
    ('community-padres-inala-the-koala-a9b43fa8'  , 'padres'        ),  -- Inala the Koala (_)
    ('community-padres-rex-the-lion-8cbddc2d'     , 'padres'        ),  -- Rex the Lion (_)
    ('community-padres-panda-dc6c4738'            , 'padres'        )  -- Panda (_)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- dogs -- 1 listings.
-- Sadie, Danny Duffy's dog.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'dogs'
from (
  values
    ('danny-duffy-player-designed-2019'  , 'royals'        )  -- Danny Duffy And Sadie (Player Designed)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- duos -- 8 listings.
-- Two figures on one base: Snoopy & Woodstock twice, the Alou brothers, Bonds
-- father-and-son, Swanson & Culberson, Munoz & Matilda, the Royals' two
-- broadcasters and Duffy with his dog.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'duos'
from (
  values
    ('giants-themed-peanuts-2022'                         , 'giants'        ),  -- Snoopy Woodstock Dual
    ('snoopy-woodstock-doghouse-2022'                     , 'blue-jays'     ),  -- Snoopy & Woodstock (Doghouse)
    ('community-mariners-andres-munoz-matilda--df87e072'  , 'mariners'      ),  -- Andres Munoz & Matilda 
    ('you-make-the-call-2023'                             , 'royals'        ),  -- Denny Matthews And Ryan Lefebvre (You Make The Call)
    ('danny-duffy-player-designed-2019'                   , 'royals'        ),  -- Danny Duffy And Sadie (Player Designed)
    ('alou-brothers-2019'                                 , 'giants'        ),  -- Alou Brothers
    ('bonds-father-son-2018'                              , 'giants'        ),  -- Bonds Father-Son
    ('swanberson-swanson-culberson-2019'                  , 'braves'        )  -- "Swanberson" (Swanson & Culberson)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- triples -- 2 listings.
-- The Rangers' three-dot race counter and the Pirates' Young Guns.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'triples'
from (
  values
    ('dot-race-results-2026'              , 'rangers'       ),  -- Red Dot/Blue Dot/Green Dot (Dot Race Results Counter)
    ('young-guns-duke-doumit-duffy-2006'  , 'pirates'       )  -- "Young Guns" (Duke, Doumit, Duffy)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   mascot: +26
--   animals: +18
--   dogs: +1
--   duos: +8
--   triples: +2

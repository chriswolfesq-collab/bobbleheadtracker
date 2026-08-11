-- Site-wide tagging pass, part 3 of 6: Awards, feats and milestones.
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
-- record-holder-breaker -- 30 listings.
-- Career milestones and records the listing names: 400 and 500 home runs,
-- 2,000 hits, 262 hits, 2131, 30/30, 50/50, scoreless streaks, a franchise
-- home run lead.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'record-holder-breaker'
from (
  values
    ('mike-trout-400-hr-2026'                                          , 'angels'        ),  -- Mike Trout (400 HR)
    ('albert-pujols-500-home-runs-2014'                                , 'angels'        ),  -- Albert Pujols (500 Career Home Runs)
    ('altuve-2000-hits-2024'                                           , 'astros'        ),  -- Jose Altuve (2000 Hits)
    ('jeff-bagwell-400th-hr-2012'                                      , 'astros'        ),  -- Jeff Bagwell (400th HR)
    ('albert-pujols-703-2023'                                          , 'cardinals'     ),  -- Albert Pujols (703)
    ('kerry-wood-2026'                                                 , 'cubs'          ),  -- Kerry Wood (20K Game)
    ('kerry-wood-20-strikeout-game-2014'                               , 'cubs'          ),  -- Kerry Wood (20-Strikeout Game)
    ('zac-gallen-scoreless-streak-2023'                                , 'diamondbacks'  ),  -- Zac Gallen (Scoreless Streak)
    ('community-diamondbacks-corbin-carroll-30-30-stealing--398f6184'  , 'diamondbacks'  ),  -- Corbin Carroll (30/30, Stealing)
    ('community-diamondbacks-corbin-carroll-30-30-swinging--6b93b4b9'  , 'diamondbacks'  ),  -- Corbin Carroll (30/30, Swinging)
    ('eric-karros-all-time-dodger-home-run-leader-2012'                , 'dodgers'       ),  -- Eric Karros (All-Time Dodger Home Run Leader)
    ('mike-scioscia-all-time-dodger-leader-games-caught-2012'          , 'dodgers'       ),  -- Mike Scioscia (All-Time Dodger Leader Games Caught)
    ('orel-hershiser-30th-anniversary-scoreless-inning-streak-2018'    , 'dodgers'       ),  -- Orel Hershiser (30th Anniversary: Scoreless Inning Streak)
    ('shohei-ohtani-50-50-hitting-2025'                                , 'dodgers'       ),  -- Shohei Ohtani 50/50 (Hitting)
    ('shohei-ohtani-50-50-sliding-2025'                                , 'dodgers'       ),  -- Shohei Ohtani (50/50 Sliding)
    ('jim-thome-hr-king-2002'                                          , 'guardians'     ),  -- Jim Thome (HR King)
    ('cal-raleigh-60-home-run-2026'                                    , 'mariners'      ),  -- Cal Raleigh ("60 Home Run")
    ('ichiro-suzuki-262-hits-2005'                                     , 'mariners'      ),  -- Ichiro Suzuki (262 Hits)
    ('luis-castillo-2003'                                              , 'marlins'       ),  -- Luis Castillo (35 Game Hitting Streak, 2002)
    ('juan-soto-40-30-2026'                                            , 'mets'          ),  -- Juan Soto (40/30)
    ('cal-ripken-jr-2131-30th-anniversary-2026'                        , 'orioles'       ),  -- Cal Ripken Jr. ("2131", 30th Anniversary)
    ('cedric-mullins-30-30-club-2022'                                  , 'orioles'       ),  -- Cedric Mullins (30/30 Club)
    ('community-padres-trevor-hoffman--b5d6030f'                       , 'padres'        ),  -- Trevor Hoffman (601 Saves)
    ('dylan-cease-2025'                                                , 'padres'        ),  -- Dylan Cease (No Hitter)
    ('bobby-witt-jr-2025-6-14'                                         , 'royals'        ),  -- Bobby Witt Jr.  (Record Breaker)
    ('community-royals-bobby-witt-jr--15308e75'                        , 'royals'        ),  -- Bobby Witt Jr. (Sliding 30/30 Season)
    ('salvador-perez-2022'                                             , 'royals'        ),  -- Salvador Perez (48 Home Runs)
    ('miguel-cabrera-500-hr-2022'                                      , 'tigers'        ),  -- Miguel Cabrera (500 HR)
    ('30-hr-bomba-club-2021'                                           , 'twins'         ),  -- "30 HR Bomba Club" (Sano, Rosario, Garver, Cruz, Kepler)
    ('roger-maris-61-2023'                                             , 'yankees'       )  -- Roger Maris (#61)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- walk-off -- 10 listings.
-- Walk-offs the listing names. Ten of them; the tag had three.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'walk-off'
from (
  values
    ('alex-bregman-walk-off-2018'                            , 'astros'        ),  -- Alex Bregman (Walk Off)
    ('jeff-kent-walk-off-2012'                               , 'astros'        ),  -- Jeff Kent (Walk Off)
    ('chrs-burke-walk-off-2012'                              , 'astros'        ),  -- Chris Burke (Walk Off)
    ('michael-busch-2025'                                    , 'cubs'          ),  -- Michael Busch ("Lighting Walkoff")
    ('freddie-freeman-world-series-grand-slam-walkoff-2025'  , 'dodgers'       ),  -- Freddie Freeman (World Series Grand Slam Walkoff)
    ('cody-bellinger-nlcs-walk-off-2019'                     , 'dodgers'       ),  -- Cody Bellinger (NLCS Walk-Off)
    ('justin-turner-walk-off-home-run-2018'                  , 'dodgers'       ),  -- Justin Turner (Walk-Off Home Run)
    ('sean-rodriguez-walk-off-2018'                          , 'pirates'       ),  -- Sean Rodriguez (Walk-Off)
    ('nolan-arenado-walk-off-cycle-2018'                     , 'rockies'       ),  -- Nolan Arenado (Walk-Off Cycle)
    ('tim-anderson-2022'                                     , 'white-sox'     )  -- Tim Anderson (Field of Dreams Walkoff Homer)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- no-hitter -- 1 listings.
-- Dylan Cease's, the one the earlier sweep predates.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'no-hitter'
from (
  values
    ('dylan-cease-2025'  , 'padres'        )  -- Dylan Cease (No Hitter)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- home-run-derby -- 2 listings.
-- Luis Gonzalez's 2001 Derby and Justin Bour's 2018 one.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'home-run-derby'
from (
  values
    ('luis-gonzalez-hr-derby-2002'                , 'diamondbacks'  ),  -- Luis Gonzalez (HR Derby)
    ('justin-bour-home-run-derby-superhero-2018'  , 'marlins'       )  -- Justin Bour (Home Run Derby Superhero)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- world-baseball-classic -- 2 listings.
-- Two more WBC listings, both Mariners.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'world-baseball-classic'
from (
  values
    ('julio-rodriguez-dominican-republic-2023'      , 'mariners'      ),  -- Julio Rodriguez (WBC Dominican Republic)
    ('community-mariners-eugenio-suarez--5c712bb6'  , 'mariners'      )  -- Eugenio Suarez (WBC Venezuela)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- all-star -- 1 listings.
-- Altuve's, spelled "Allstar", which the earlier match on "All-Star" missed.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'all-star'
from (
  values
    ('jose-altuve-allstar-2013'  , 'astros'        )  -- Jose Altuve (Allstar)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- world-series -- 2 listings.
-- Bellinger's WS MVP and the White Sox 2005 celebration dual.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'world-series'
from (
  values
    ('cody-bellinger-world-series-mvp-2021'  , 'dodgers'       ),  -- Cody Bellinger (World Series MVP)
    ('bobby-jenks-aj-pierzynski-2026'        , 'white-sox'     )  -- Bobby Jenks & A.J. Pierzynski (2005 WS Celebration)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- mvp -- 1 listings.
-- The Dodgers' 1981 Tri-MVP.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'mvp'
from (
  values
    ('guerrero-yeager-cey-1981-tri-mvp-2016'  , 'dodgers'       )  -- Guerrero/Yeager/Cey (1981 Tri-MVP)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- cy-young -- 1 listings.
-- Felix Hernandez's 2010 award.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'cy-young'
from (
  values
    ('felix-hernandez-2011'  , 'mariners'      )  -- Felix Hernandez (2010 Cy Young Winner)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- gold-glove -- 6 listings.
-- Six more, Platinum Gloves included -- Yadier Molina's "Gold & Platinum
-- Gloves" already set that precedent.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'gold-glove'
from (
  values
    ('gerardo-parra-2014'                   , 'diamondbacks'  ),  -- Gerardo Parra (Gold Glove)
    ('gerardo-parra-2012'                   , 'diamondbacks'  ),  -- Gerardo Parra (Gold Glove)
    ('matt-chapman-2025'                    , 'giants'        ),  -- Matt Chapman (Gold Glove)
    ('cal-raleigh-2025'                     , 'mariners'      ),  -- Cal Raleigh (Platinum Glove)
    ('fernando-tatis-jr-2024'               , 'padres'        ),  -- Fernando Tatis Jr. (Platinum Glove)
    ('kevin-kiermaier-platinum-glove-2016'  , 'rays'          )  -- Kevin Kiermaier (Platinum Glove)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- silver-slugger -- 2 listings.
-- Two the earlier sweep missed.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'silver-slugger'
from (
  values
    ('luis-arraez-2024'                     , 'padres'        ),  -- Luis Arraez (Silver Slugger)
    ('community-cubs-javier-baez-ce0bed1b'  , 'cubs'          )  -- Javier Baez (Silver Slugger Award)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- manager-of-the-year -- 1 listings.
-- Buck Showalter's 2004 AL award.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'manager-of-the-year'
from (
  values
    ('buck-showalter-2004-al-manager-of-the-year-2005'  , 'rangers'       )  -- Buck Showalter (2004 AL Manager of the Year)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- hall-of-fame -- 17 listings.
-- The Royals' HOF Series -- sixteen listings, all naming the team hall -- plus
-- the Rays' hall.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'hall-of-fame'
from (
  values
    ('whitey-herzog-2021'                     , 'royals'        ),  -- Whitey Herzog (Hof Series)
    ('kevin-appier-2017'                      , 'royals'        ),  -- Kevin Appier (Hof Series)
    ('joakim-soria-2011'                      , 'royals'        ),  -- Joakim Soria (HOF Series)
    ('willie-wilson-2011'                     , 'royals'        ),  -- Willie Wilson (HOF Series)
    ('bret-saberhagen-2010'                   , 'royals'        ),  -- Bret Saberhagen (HOF Series)
    ('larry-gura-2008'                        , 'royals'        ),  -- Larry Gura (HOF Series)
    ('dan-quisenberry-2008'                   , 'royals'        ),  -- Dan Quisenberry (HOF Series)
    ('john-mayberry-2008'                     , 'royals'        ),  -- John Mayberry (HOF Series)
    ('fred-patek-2007'                        , 'royals'        ),  -- Fred Patek (HOF Series)
    ('cookie-rojas-2007'                      , 'royals'        ),  -- Cookie Rojas (HOF Series)
    ('steve-busby-2007'                       , 'royals'        ),  -- Steve Busby (HOF Series)
    ('dennis-leonard-2007'                    , 'royals'        ),  -- Dennis Leonard (HOF Series)
    ('paul-splittorff-2007'                   , 'royals'        ),  -- Paul Splittorff (HOF Series)
    ('george-brett-2006'                      , 'royals'        ),  -- George Brett (Hof Series)
    ('dick-howser-2006'                       , 'royals'        ),  -- Dick Howser (Hof Series)
    ('frank-white-2006'                       , 'royals'        ),  -- Frank White (Hof Series)
    ('community-rays-evan-longoria-dd9fbfe1'  , 'rays'          )  -- Evan Longoria (Tampa Bay Rays Hall of Fame/Bobblecard)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   record-holder-breaker: +30
--   walk-off: +10
--   no-hitter: +1
--   home-run-derby: +2
--   world-baseball-classic: +2
--   all-star: +1
--   world-series: +2
--   mvp: +1
--   cy-young: +1
--   gold-glove: +6
--   silver-slugger: +2
--   manager-of-the-year: +1
--   hall-of-fame: +17

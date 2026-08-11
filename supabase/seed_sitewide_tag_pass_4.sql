-- Site-wide tagging pass, part 4 of 6: People: managers, the booth, celebrities.
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
-- manager -- 86 listings.
-- Read as the first pass read it: the tag is about the person, not the pose.
-- Every MLB manager in the catalog, including the ones whose listing is a
-- statue, a gnome or a Game of Thrones joke. Listings that plainly commemorate
-- a playing moment are left alone -- Dave Roberts' 2004 steal, Alan Trammell,
-- Paul Molitor.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'manager'
from (
  values
    ('dusty-baker-2022'                                        , 'astros'        ),  -- Dusty Baker
    ('larry-dierker-hands-by-side-2010'                        , 'astros'        ),  -- Larry Dierker (Hands by Side)
    ('larry-dierker-williams-brand-2001'                       , 'astros'        ),  -- Larry Dierker (Williams Brand)
    ('cito-gaston-2008'                                        , 'blue-jays'     ),  -- Cito Gaston
    ('cito-gaston-2006'                                        , 'blue-jays'     ),  -- Cito Gaston
    ('bobby-cox-carried-off-2016'                              , 'braves'        ),  -- Bobby Cox ("Carried Off")
    ('bobby-cox-2014'                                          , 'braves'        ),  -- Bobby Cox
    ('bobby-cox-2008'                                          , 'braves'        ),  -- Bobby Cox
    ('bobby-cox-2003'                                          , 'braves'        ),  -- Bobby Cox
    ('craig-counsell-indiana-jones-2023'                       , 'brewers'       ),  -- Craig Counsell (Indiana Jones)
    ('craig-counsell-2016'                                     , 'brewers'       ),  -- Craig Counsell
    ('craig-counsell-2011'                                     , 'brewers'       ),  -- Craig Counsell
    ('joe-torre-2022'                                          , 'cardinals'     ),  -- Joe Torre
    ('whitey-herzog-fishing-2021'                              , 'cardinals'     ),  -- Whitey Herzog (Fishing)
    ('whitey-herzog-2010'                                      , 'cardinals'     ),  -- Whitey Herzog
    ('whitey-herzog-2005'                                      , 'cardinals'     ),  -- Whitey Herzog
    ('tony-la-russa-2007'                                      , 'cardinals'     ),  -- Tony La Russa
    ('red-schoendienst-2008'                                   , 'cardinals'     ),  -- Red Schoendienst
    ('mike-matheny-2013'                                       , 'cardinals'     ),  -- Mike Matheny
    ('mystery-hall-of-fame-manager-2017'                       , 'cardinals'     ),  -- Mystery Hall of Fame Manager
    ('joe-maddon-2016'                                         , 'cubs'          ),  -- Joe Maddon
    ('joe-maddon-cubs-debut-2015'                              , 'cubs'          ),  -- Joe Maddon (Cubs Debut)
    ('david-ross-2022'                                         , 'cubs'          ),  -- David Ross
    ('lou-piniella-2007'                                       , 'cubs'          ),  -- Lou Piniella
    ('bob-brenly-2014'                                         , 'diamondbacks'  ),  -- Bob Brenly
    ('bob-brenly-2002'                                         , 'diamondbacks'  ),  -- Bob Brenly
    ('tony-la-russa-2015'                                      , 'diamondbacks'  ),  -- Tony La Russa
    ('bob-melvin-2008'                                         , 'diamondbacks'  ),  -- Bob Melvin
    ('kirk-gibson-2011'                                        , 'diamondbacks'  ),  -- Kirk Gibson
    ('craig-counsell-2003'                                     , 'diamondbacks'  ),  -- Craig Counsell
    ('dave-roberts-2026'                                       , 'dodgers'       ),  -- Dave Roberts
    ('dusty-baker-2024'                                        , 'dodgers'       ),  -- Dusty Baker
    ('dusty-baker-2016'                                        , 'dodgers'       ),  -- Dusty Baker
    ('don-mattingly-2011'                                      , 'dodgers'       ),  -- Don Mattingly
    ('tommy-lasorda-brooklyn-debut-2014'                       , 'dodgers'       ),  -- Tommy Lasorda (Brooklyn Debut)
    ('mike-scioscia-all-time-dodger-leader-games-caught-2012'  , 'dodgers'       ),  -- Mike Scioscia (All-Time Dodger Leader Games Caught)
    ('alston-lasorda-hall-of-fame-managers-dual-2012'          , 'dodgers'       ),  -- Walter Alston/Tommy Lasorda (Hall of Fame Managers Dual)
    ('bruce-bochy-runner-2018'                                 , 'giants'        ),  -- Bruce Bochy (Runner)
    ('bruce-bochy-vulcan-2016'                                 , 'giants'        ),  -- Bruce Bochy (Vulcan)
    ('bruce-bochy-2010'                                        , 'giants'        ),  -- Bruce Bochy
    ('house-bochy-2019'                                        , 'giants'        ),  -- House Bochy (Game of Thrones)
    ('gabe-kapler-2022'                                        , 'giants'        ),  -- Gabe Kapler (Special Event Jewish Heritage)
    ('felipe-alou-2005'                                        , 'giants'        ),  -- Felipe Alou (Rewards Club)
    ('terry-francona-2017'                                     , 'guardians'     ),  -- Terry Francona
    ('terry-francona-red-scooter-2015'                         , 'guardians'     ),  -- Terry Francona (Red Scooter)
    ('mike-hargrove-2011'                                      , 'guardians'     ),  -- Mike Hargrove
    ('casey-stengel-2014'                                      , 'mets'          ),  -- Casey Stengel
    ('willie-randolph-2005'                                    , 'mets'          ),  -- Willie Randolph
    ('davey-johnson-2013'                                      , 'nationals'     ),  -- Davey Johnson
    ('dusty-baker-2016'                                        , 'nationals'     ),  -- Dusty Baker
    ('buck-showalter-2011'                                     , 'orioles'       ),  -- Buck Showalter
    ('brandon-hyde-2024'                                       , 'orioles'       ),  -- Brandon Hyde
    ('earl-weaver-bronze-statue-2012'                          , 'orioles'       ),  -- Earl Weaver (Bronze Statue)
    ('frank-robinson-bronze-statue-2012'                       , 'orioles'       ),  -- Frank Robinson (Bronze Statue)
    ('bud-black-2011'                                          , 'padres'        ),  -- Bud Black (Manager of the Year)
    ('charlie-manuel-2009'                                     , 'phillies'      ),  -- Charlie Manuel
    ('larry-bowa-2015'                                         , 'phillies'      ),  -- Larry Bowa
    ('larry-bowa-2001'                                         , 'phillies'      ),  -- Larry Bowa
    ('rob-thomson-papa-elf-2023'                               , 'phillies'      ),  -- Rob Thomson ("Papa Elf")
    ('chuck-tanner-2004'                                       , 'pirates'       ),  -- Chuck Tanner
    ('phil-garner-2004'                                        , 'pirates'       ),  -- Phil Garner
    ('ron-washington-2012'                                     , 'rangers'       ),  -- Ron Washington
    ('buck-showalter-2004-al-manager-of-the-year-2005'         , 'rangers'       ),  -- Buck Showalter (2004 AL Manager of the Year)
    ('joe-maddon-2012'                                         , 'rays'          ),  -- Joe Maddon
    ('lou-piniella-2003'                                       , 'rays'          ),  -- Lou Piniella
    ('don-zimmer-2007'                                         , 'rays'          ),  -- Don Zimmer
    ('zim-bear-don-zimmer-2023'                                , 'rays'          ),  -- "Zim Bear" (Don Zimmer)
    ('dusty-baker-2011'                                        , 'reds'          ),  -- Dusty Baker
    ('frank-robinson-2007'                                     , 'reds'          ),  -- Frank Robinson
    ('skipper-gnome-2014'                                      , 'rockies'       ),  -- The Skipper Bobblehead Gnome
    ('ned-yost-2016'                                           , 'royals'        ),  -- Ned Yost
    ('dick-howser-2006'                                        , 'royals'        ),  -- Dick Howser (Hof Series)
    ('whitey-herzog-2021'                                      , 'royals'        ),  -- Whitey Herzog (Hof Series)
    ('buck-oneil-2012'                                         , 'royals'        ),  -- Buck O'Neil
    ('sparky-anderson-2019'                                    , 'tigers'        ),  -- Sparky Anderson
    ('house-gardy-2019'                                        , 'tigers'        ),  -- "House Gardy" (Ron Gardenhire)
    ('ron-gardenhire-2008'                                     , 'twins'         ),  -- Ron Gardenhire
    ('tom-kelly-2002'                                          , 'twins'         ),  -- Tom Kelly
    ('billy-martin-2006'                                       , 'twins'         ),  -- Billy Martin
    ('ozzie-guillen-2025'                                      , 'white-sox'     ),  -- Ozzie Guillen
    ('ozzie-guillen-2007'                                      , 'white-sox'     ),  -- Ozzie Guillen
    ('tony-la-russa-2014'                                      , 'white-sox'     ),  -- Tony La Russa
    ('robin-ventura-2012'                                      , 'white-sox'     ),  -- Robin Ventura
    ('joe-girardi-2014'                                        , 'yankees'       ),  -- Joe Girardi
    ('joe-torre-2002'                                          , 'yankees'       ),  -- Joe Torre
    ('don-mattingly-2021'                                      , 'yankees'       )  -- Don Mattingly
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- announcers-broadcasters -- 17 listings.
-- The booth, discovery-based as before. Milo Hamilton, Niehaus, Brickhouse,
-- Pat Hughes, McCarver, Schulte, Dickerson. Bill Schroeder and Bob Walk are in
-- the booth far longer than they played, as Hrabosky already was. Renel
-- Brooks-Moon is a PA announcer, which is how Roy Steele was read.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'announcers-broadcasters'
from (
  values
    ('milo-hamilton-orange-suit-2012'           , 'astros'        ),  -- Milo Hamilton (Orange Suit)
    ('milo-hamilton-holy-green-suit-2008'       , 'astros'        ),  -- Milo Hamilton (Holy Green Suit)
    ('bill-schroeder-disco-pose-2017'           , 'brewers'       ),  -- Bill Schroeder (Disco Pose)
    ('tim-mccarver-2017'                        , 'cardinals'     ),  -- Tim McCarver
    ('al-hrabosky-2015'                         , 'cardinals'     ),  -- Al Hrabosky
    ('community-cubs-jack-brickhouse-f6a0b81d'  , 'cubs'          ),  -- Jack Brickhouse
    ('community-cubs-pat-hughes-e94c65ae'       , 'cubs'          ),  -- Pat Hughes (Online)
    ('greg-schulte-2010'                        , 'diamondbacks'  ),  -- Greg Schulte
    ('bob-brenly-2014'                          , 'diamondbacks'  ),  -- Bob Brenly
    ('bob-brenly-2002'                          , 'diamondbacks'  ),  -- Bob Brenly
    ('renel-brooks-moon-2008'                   , 'giants'        ),  -- Renel Brooks-Moon
    ('dave-niehaus-2008'                        , 'mariners'      ),  -- Dave Niehaus
    ('bob-walk-2007'                            , 'pirates'       ),  -- Bob Walk
    ('tom-grieve-2022'                          , 'rangers'       ),  -- Tom Grieve
    ('jeff-brantley-2022'                       , 'reds'          ),  -- Jeff Brantley
    ('you-make-the-call-2023'                   , 'royals'        ),  -- Denny Matthews And Ryan Lefebvre (You Make The Call)
    ('dan-dickerson-2024'                       , 'tigers'        )  -- Dan Dickerson
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- -------------------------------------------------------------------------
-- celebrity -- 43 listings.
-- Non-baseball public figures, same reading as the first pass: musicians,
-- actors, athletes from other sports. Stan Lee is here and under Marvel.
-- Fictional characters stay out -- George Costanza, Rick Vaughn and the Bronze
-- Fonz are not people.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'celebrity'
from (
  values
    ('travis-scott-2025'                                          , 'astros'        ),  -- Travis Scott
    ('mattress-mack-2023'                                         , 'astros'        ),  -- Mattress Mack
    ('usher-2025'                                                 , 'braves'        ),  -- Usher
    ('outkast-2023'                                               , 'braves'        ),  -- OutKast
    ('paige-spiranac-2023'                                        , 'brewers'       ),  -- Paige Spiranac
    ('red-grange-2014'                                            , 'cubs'          ),  -- Red Grange
    ('gale-sayers-2014'                                           , 'cubs'          ),  -- Gale Sayers
    ('elton-john-2022'                                            , 'dodgers'       ),  -- Elton John
    ('billie-jean-king-2019'                                      , 'dodgers'       ),  -- Billie Jean King
    ('stephen-curry-2025'                                         , 'giants'        ),  -- Stephen Curry
    ('kristi-yamaguchi-signed-2022'                               , 'giants'        ),  -- Kristi Yamaguchi (signed)
    ('juli-inkster-2016'                                          , 'giants'        ),  -- Juli Inkster
    ('stan-lee-2015'                                              , 'giants'        ),  -- Stan Lee
    ('bill-graham-father-time-2016'                               , 'giants'        ),  -- Bill Graham (Father Time)
    ('rory-mcilroy-2012'                                          , 'giants'        ),  -- Rory McIlroy
    ('jerry-garcia-2012'                                          , 'giants'        ),  -- Jerry Garcia
    ('jerry-garcia-2010'                                          , 'giants'        ),  -- Jerry Garcia
    ('jennie-finch-2010'                                          , 'giants'        ),  -- Jennie Finch
    ('rob-schneider-2010'                                         , 'giants'        ),  -- Rob Schneider
    ('manny-pacquiao-2009'                                        , 'giants'        ),  -- Manny Pacquiao
    ('carlos-santana-2009'                                        , 'giants'        ),  -- Carlos Santana
    ('tony-bennett-2011'                                          , 'giants'        ),  -- Tony Bennett
    ('community-giants-stephen-curry--bd196c73'                   , 'giants'        ),  -- Stephen Curry (Super Hero ( Special Event))
    ('kid-cudi-2023'                                              , 'guardians'     ),  -- Kid Cudi
    ('macklemore-2014'                                            , 'mariners'      ),  -- Macklemore
    ('community-mariners-mike-mccready-special-ticket--c35563c8'  , 'mariners'      ),  -- Mike McCready (special ticket)
    ('community-mariners-mike-mccready-special-ticket--e2a26f9d'  , 'mariners'      ),  -- Mike McCready (special ticket)
    ('miles-teller-rooster-2022'                                  , 'phillies'      ),  -- Miles Teller (Rooster)
    ('mac-miller-2025'                                            , 'pirates'       ),  -- Mac Miller
    ('wiz-khalifa-2024'                                           , 'pirates'       ),  -- Wiz Khalifa
    ('charley-pride-2022'                                         , 'rangers'       ),  -- Charley Pride
    ('community-rangers-leon-bridges-630d145c'                    , 'rangers'       ),  -- Leon Bridges
    ('tuukka-rask-2017'                                           , 'red-sox'       ),  -- Tuukka Rask
    ('jerry-garcia-2023'                                          , 'reds'          ),  -- Jerry Garcia
    ('ice-cube-2025'                                              , 'white-sox'     ),  -- Ice Cube
    ('charles-tillman-2017'                                       , 'white-sox'     ),  -- Charles Tillman
    ('community-white-sox-scottie-pippen-a0b0c264'                , 'white-sox'     ),  -- Scottie Pippen
    ('frank-sinatra-2024'                                         , 'yankees'       ),  -- Frank Sinatra
    ('frank-sinatra-2023'                                         , 'yankees'       ),  -- Frank Sinatra
    ('eli-manning-2024'                                           , 'yankees'       ),  -- Eli Manning
    ('josh-hart-no-32-elston-howard-tribute-2026'                 , 'yankees'       ),  -- Josh Hart (No. 32, Elston Howard Tribute)
    ('jerry-garcia-2023'                                          , 'yankees'       ),  -- Jerry Garcia
    ('jerry-garcia-2022'                                          , 'yankees'       )  -- Jerry Garcia
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What should land:
--   manager: +86
--   announcers-broadcasters: +17
--   celebrity: +43

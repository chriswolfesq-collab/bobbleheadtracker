-- Nine more tags: five awards and four counts of how many figures are on the
-- base.
--
-- The awards are mechanical -- the listing names the award or it doesn't. The
-- counts are not quite: Duos, Triples and Quads come from an explicit
-- Dual/Triple/Quad where the catalog gives one, and otherwise from counting
-- the people a title names. That counting skips any part carrying a digit, so
-- "No-Hitter June 29, 1990" stays one man rather than becoming a duo.
--
-- Idempotent. Needs the widened key from supabase/fix_bobblehead_tags_pk.sql.
-- Paste into the Supabase SQL editor.

insert into public.tags (slug, label)
values ('mvp', 'MVP')
on conflict (slug) do nothing;

-- MVP -- 36 listings.
-- League, World Series, LCS and All-Star MVPs alike -- the listing says MVP.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'mvp'
from (
  values
    ('mike-trout-3x-mvp-2021', 'angels'),                             -- Mike Trout (3x MVP), 2021
    ('mike-trout-mvp-1-of-3-2017', 'angels'),                         -- Mike Trout (MVP, #1 of 3), 2017
    ('mike-trout-mvp-2-of-3-2017', 'angels'),                         -- Mike Trout (MVP, #2 of 3), 2017
    ('mike-trout-mvp-3-of-3-2017', 'angels'),                         -- Mike Trout (MVP, #3 of 3), 2017
    ('mike-trout-mvp-double-2017', 'angels'),                         -- Mike Trout (MVP Double), 2017
    ('shohei-ohtani-mvp-2022', 'angels'),                             -- Shohei Ohtani (MVP), 2022
    ('jose-altuve-al-mvp-2018', 'astros'),                            -- Jose Altuve (AL MVP), 2018
    ('pena-mvp-2023', 'astros'),                                      -- Jeremy Pena (MVP), 2023
    ('jason-giambi-2000-mvp-2001', 'athletics'),                      -- Jason Giambi (2000 MVP), 2001
    ('miguel-tejada-2002-mvp-2003', 'athletics'),                     -- Miguel Tejada (2002 MVP), 2003
    ('community-braves-eddie-rosario-nlcs-mvp-3a7ca824', 'braves'),   -- Eddie Rosario NLCS MVP [community]
    ('eddie-rosario-nlcs-mvp-2022', 'braves'),                        -- Eddie Rosario (NLCS MVP), 2022
    ('freddie-freeman-2020-nl-mvp-2021', 'braves'),                   -- Freddie Freeman (2020 NL MVP), 2021
    ('community-brewers-christian-yelich-mvp-bb91fcb9', 'brewers'),   -- Christian Yelich MVP [community]
    ('paul-goldschmidt-mvp-2023', 'cardinals'),                       -- Paul Goldschmidt (MVP), 2023
    ('ben-zobrist-world-series-mvp-2017', 'cubs'),                    -- Ben Zobrist (World Series MVP), 2017
    ('cody-bellinger-world-series-mvp-2021', 'dodgers'),              -- Cody Bellinger World Series MVP, 2021
    ('corey-seager-world-series-mvp-2021', 'dodgers'),                -- Corey Seager World Series MVP, 2021
    ('guerrero-yeager-cey-1981-tri-mvp-2016', 'dodgers'),             -- Guerrero/Yeager/Cey 1981 Tri-MVP, 2016
    ('kirk-gibson-1988-mvp-2012', 'dodgers'),                         -- Kirk Gibson 1988 MVP, 2012
    ('shohei-ohtani-mvp-2025', 'dodgers'),                            -- Shohei Ohtani MVP, 2025
    ('buster-posey-nl-mvp-2013', 'giants'),                           -- Buster Posey (NL MVP), 2013
    ('madison-bumgarner-postseason-mvp-2015', 'giants'),              -- Madison Bumgarner (Postseason MVP), 2015
    ('bryce-harper-mvp-2016', 'nationals'),                           -- Bryce Harper (MVP), 2016
    ('jimmy-rollins-mvp-2008', 'phillies'),                           -- Jimmy Rollins (MVP), 2008
    ('ryan-howard-mvp-figurine-2007', 'phillies'),                    -- Ryan Howard (MVP Figurine), 2007
    ('andrew-mccutchen-nl-mvp-2014', 'pirates'),                      -- Andrew McCutchen (N.L. MVP), 2014
    ('adolis-garcia-alcs-mvp-gold-glove-2024', 'rangers'),            -- Adolis García (ALCS MVP/Gold Glove), 2024
    ('corey-seager-2023-world-series-mvp-2024', 'rangers'),           -- Corey Seager (2023 World Series MVP), 2024
    ('joey-votto-mvp-2011', 'reds'),                                  -- Joey Votto (MVP), 2011
    ('community-royals-eric-hosmer-1c4ae9cf', 'royals'),              -- Eric Hosmer (All-Star MVP) [community]
    ('miguel-cabrera-2-time-mvp-2014', 'tigers'),                     -- Miguel Cabrera (2-Time MVP), 2014
    ('justin-morneau-al-mvp-2007', 'twins'),                          -- Justin Morneau (AL MVP), 2007
    ('dick-allen-1972-mvp-2025', 'white-sox'),                        -- Dick Allen (1972 MVP), 2025
    ('jose-abreu-2020-mvp-2021', 'white-sox'),                        -- Jose Abreu (2020 MVP), 2021
    ('aaron-judge-mvp-2nd-consecutive-2026', 'yankees')               -- Aaron Judge (MVP, 2nd Consecutive), 2026
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('cy-young', 'Cy Young')
on conflict (slug) do nothing;

-- Cy Young -- 24 listings.
-- The award. The catalog has no bobblehead of Cy Young himself, so every match is a winner.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'cy-young'
from (
  values
    ('dallas-keuchel-cy-young-2016', 'astros'),                        -- Dallas Keuchel (CY Young), 2016
    ('justin-verlander-cy-young-2021', 'astros'),                      -- Justin Verlander (Cy Young), 2021
    ('barry-zito-cy-young-2003', 'athletics'),                         -- Barry Zito (Cy Young), 2003
    ('roy-halladay-cy-young-2004', 'blue-jays'),                       -- Roy Halladay (Cy Young), 2004
    ('greg-maddux-cy-young-2022', 'braves'),                           -- Greg Maddux (Cy Young), 2022
    ('john-smoltz-cy-young-2022', 'braves'),                           -- John Smoltz (Cy Young), 2022
    ('tom-glavine-cy-young-2022', 'braves'),                           -- Tom Glavine (Cy Young), 2022
    ('chris-carpenter-cy-young-20th-anniversary-2025', 'cardinals'),   -- Chris Carpenter (Cy Young 20th Anniversary), 2025
    ('brandon-webb-cy-young-2007', 'diamondbacks'),                    -- Brandon Webb (Cy Young), 2007
    ('randy-johnson-cy-young-2002', 'diamondbacks'),                   -- Randy Johnson (Cy Young), 2002
    ('clayton-kershaw-cy-young-2014', 'dodgers'),                      -- Clayton Kershaw Cy Young, 2014
    ('don-drysdale-1962-cy-young-2004', 'dodgers'),                    -- Don Drysdale 1962 Cy Young, 2004
    ('don-drysdale-maury-wills-cy-young-dual-2012', 'dodgers'),        -- Don Drysdale & Maury Wills Cy Young Dual, 2012
    ('don-newcombe-1956-cy-young-2004', 'dodgers'),                    -- Don Newcombe 1956 Cy young, 2004
    ('eric-gagne-2003-cy-young-2004', 'dodgers'),                      -- Eric Gagne 2003 Cy Young, 2004
    ('orel-hershiser-1988-cy-young-2012', 'dodgers'),                  -- Orel Hershiser 1988 Cy Young, 2012
    ('c-c-sabathia-cy-young-2008', 'guardians'),                       -- C.C. Sabathia Cy Young, 2008
    ('cliff-lee-cy-young-2009', 'guardians'),                          -- Cliff Lee (Cy Young), 2009
    ('shane-bieber-cy-young-award-2021', 'guardians'),                 -- Shane Bieber (Cy Young Award), 2021
    ('jacob-degrom-cy-young-2019', 'mets'),                            -- Jacob deGrom (Cy Young), 2019
    ('max-scherzer-cy-young-2018', 'nationals'),                       -- Max Scherzer (Cy Young), 2018
    ('doug-drabek-cy-young-2022', 'pirates'),                          -- Doug Drabek (Cy Young), 2022
    ('rick-porcello-cy-young-2017', 'red-sox'),                        -- Rick Porcello (Cy Young), 2017
    ('max-scherzer-2013-cy-young-2014', 'tigers')                      -- Max Scherzer (2013 Cy Young), 2014
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('silver-slugger', 'Silver Slugger')
on conflict (slug) do nothing;

-- Silver Slugger -- 17 listings.
-- The batting award. These matched the Mascot sweep too, via "Slugger" -- they were excluded there and belong here.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'silver-slugger'
from (
  values
    ('mike-trout-silver-slugger-2019', 'angels'),             -- Mike Trout (Silver Slugger), 2019
    ('mike-trout-silver-slugger-2023', 'angels'),             -- Mike Trout (Silver Slugger), 2023
    ('vladimir-guerrero-silver-slugger-2006', 'angels'),      -- Vladimir Guerrero (Silver Slugger), 2006
    ('altuve-silver-slugger-2023', 'astros'),                 -- Jose Altuve (Silver Slugger), 2023
    ('jose-altuve-silver-slugger-2025', 'astros'),            -- Jose Altuve (Silver Slugger), 2025
    ('king-tuck-silver-slugger-2024', 'astros'),              -- Kyle Tucker (Silver Slugger), 2024
    ('yordan-silver-slugger-2023', 'astros'),                 -- Yordan Alvarez (Silver Slugger), 2023
    ('brent-rooker-silver-slugger-2025', 'athletics'),        -- Brent Rooker (Silver Slugger), 2025
    ('teoscar-hernandez-silver-slugger-2022', 'blue-jays'),   -- Teoscar Hernandez (Silver Slugger), 2022
    ('2019-silver-sluggers-2021', 'braves'),                  -- 2019 Silver Sluggers, 2021
    ('corey-seager-silver-slugger-2018', 'dodgers'),          -- Corey Seager Silver Slugger, 2018
    ('pedro-alvarez-silver-slugger-2014', 'pirates'),         -- Pedro Alvarez (Silver Slugger), 2014
    ('corey-seager-silver-slugger-2024', 'rangers'),          -- Corey Seager (Silver Slugger), 2024
    ('marcus-semien-silver-slugger-2024', 'rangers'),         -- Marcus Semien (Silver Slugger), 2024
    ('nathaniel-lowe-silver-slugger-2023', 'rangers'),        -- Nathaniel Lowe (Silver Slugger), 2023
    ('billy-butler-silver-slugger-2013', 'royals'),           -- Billy Butler (Silver Slugger), 2013
    ('jose-abreu-silver-slugger-2019', 'white-sox')           -- Jose Abreu (Silver Slugger), 2019
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('rookie-of-the-year', 'Rookie of the Year')
on conflict (slug) do nothing;

-- Rookie of the Year -- 12 listings.
-- Spelled out, or nicknamed exactly "ROY". A looser match on "roy" pulls in Roy Oswalt, Roy Halladay and Roy Steele, none of whom won it.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'rookie-of-the-year'
from (
  values
    ('shohei-ohtani-rookie-of-the-year-2019', 'angels'),                -- Shohei Ohtani (Rookie of the Year), 2019
    ('alvarez-roy-2021', 'astros'),                                     -- Yordan Alvarez (ROY), 2021
    ('carlos-correa-roy-2016', 'astros'),                               -- Carlos Correa (ROY), 2016
    ('huston-street-2005-rookie-of-the-year-2006', 'athletics'),        -- Huston Street (2005 Rookie of the Year), 2006
    ('drake-baldwin-nl-rookie-of-the-year-2026', 'braves'),             -- Drake Baldwin (NL Rookie of the Year), 2026
    ('michael-harris-ii-rookie-of-the-year-2023', 'braves'),            -- Michael Harris II (Rookie of the Year), 2023
    ('corbin-carroll-2024', 'diamondbacks'),                            -- Corbin Carroll (Rookie of the Year), 2024
    ('cody-bellinger-rookie-of-the-year-2018', 'dodgers'),              -- Cody Bellinger Rookie of the Year, 2018
    ('corey-seager-rookie-of-the-year-2017', 'dodgers'),                -- Corey Seager Rookie of the Year, 2017
    ('jason-bay-nl-rookie-of-the-year-2005', 'pirates'),                -- Jason Bay (NL Rookie of the Year), 2005
    ('adolis-garcia-el-bombi-al-rookie-of-the-year-2022', 'rangers'),   -- Adolis Garcia (El Bombi AL Rookie of the Year), 2022
    ('wil-myers-rookie-of-the-year-2014', 'rays')                       -- Wil Myers (Rookie of the Year), 2014
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('batting-champion', 'Batting Champion')
on conflict (slug) do nothing;

-- Batting Champion -- 8 listings.
-- Batting titles, including the Rangers' two-part Batting Champs set and a Rockies gnome.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'batting-champion'
from (
  values
    ('freddy-sanchez-2006-batting-champion-2007', 'pirates'),                  -- Freddy Sanchez (2006 Batting Champion), 2007
    ('josh-hamilton-top-moments-the-batting-champs-1-of-2-2019', 'rangers'),   -- Josh Hamilton Top Moments - The Batting Champs (1 of 2), 2019
    ('michael-young-batting-champion-2006', 'rangers'),                        -- Michael Young (Batting Champion), 2006
    ('michael-young-top-moments-the-batting-champs-2-of-2-2019', 'rangers'),   -- Michael Young Top Moments - The Batting Champs (2 of 2), 2019
    ('batting-champ-gnome-2014', 'rockies'),                                   -- Batting Champ Bobblehead Gnome, 2014
    ('charlie-blackmon-nl-batting-champion-2018', 'rockies'),                  -- Charlie Blackmon (NL Batting Champion), 2018
    ('justin-morneau-batting-champ-2015', 'rockies'),                          -- Justin Morneau (Batting Champ), 2015
    ('joe-mauer-al-batting-champ-2007', 'twins')                               -- Joe Mauer (AL Batting Champ), 2007
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('mini-bobbles', 'Mini Bobbles')
on conflict (slug) do nothing;

-- Mini Bobbles -- 89 listings.
-- The small ones -- a format, like Audio and Bobblecard, rather than anything about the player.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'mini-bobbles'
from (
  values
    ('community-angels-hideki-matsui-cb0f3009', 'angels'),                                  -- Hideki Matsui (Group Ticket Mini Bobblehead) [community]
    ('hunter-pence-mini-kids-club-exclusive-2010', 'astros'),                               -- Hunter Pence (Mini Kids Club Exclusive), 2010
    ('adam-lind-mini-2008', 'blue-jays'),                                                   -- Adam Lind (Mini), 2008
    ('alex-rios-mini-2008', 'blue-jays'),                                                   -- Alex Rios (Mini), 2008
    ('scott-rolen-mini-2008', 'blue-jays'),                                                 -- Scott Rolen (Mini), 2008
    ('dansby-swanson-mini-2022', 'braves'),                                                 -- Dansby Swanson (Mini), 2022
    ('ronald-acuna-jr-mini-2021', 'braves'),                                                -- Ronald Acuna Jr. (Mini), 2021
    ('bernie-brewer-yarn-mini-2018', 'brewers'),                                            -- Bernie Brewer (Yarn, Mini), 2018
    ('bill-hall-mini-2006', 'brewers'),                                                     -- Bill Hall (Mini), 2006
    ('brady-clark-mini-2006', 'brewers'),                                                   -- Brady Clark (Mini), 2006
    ('chris-capuano-mini-2006', 'brewers'),                                                 -- Chris Capuano (Mini), 2006
    ('craig-counsell-mini-2004', 'brewers'),                                                -- Craig Counsell (Mini), 2004
    ('craig-counsell-mini-2017', 'brewers'),                                                -- Craig Counsell (Mini), 2017
    ('doug-davis-mini-2005', 'brewers'),                                                    -- Doug Davis (Mini), 2005
    ('ed-sedar-mini-2018', 'brewers'),                                                      -- Ed Sedar (Mini), 2018
    ('geoff-jenkins-mini-2004', 'brewers'),                                                 -- Geoff Jenkins (Mini), 2004
    ('junior-spivey-mini-2005', 'brewers'),                                                 -- Junior Spivey (Mini), 2005
    ('ned-yost-mini-2005', 'brewers'),                                                      -- Ned Yost (Mini), 2005
    ('wes-helms-mini-2004', 'brewers'),                                                     -- Wes Helms (Mini), 2004
    ('aaron-miles-mini-2016', 'cardinals'),                                                 -- Aaron Miles (Mini), 2016
    ('adam-wainwright-mini-2016', 'cardinals'),                                             -- Adam Wainwright (Mini), 2016
    ('andy-van-slyke-mini-2018', 'cardinals'),                                              -- Andy Van Slyke (Mini), 2018
    ('brad-thompson-mini-2016', 'cardinals'),                                               -- Brad Thompson (Mini), 2016
    ('chris-duncan-mini-2016', 'cardinals'),                                                -- Chris Duncan (Mini), 2016
    ('danny-cox-mini-2015', 'cardinals'),                                                   -- Danny Cox (Mini), 2015
    ('david-eckstein-mini-2016', 'cardinals'),                                              -- David Eckstein (Mini), 2016
    ('jack-clark-mini-2015', 'cardinals'),                                                  -- Jack Clark (Mini), 2015
    ('jason-isringhausen-mini-2016', 'cardinals'),                                          -- Jason Isringhausen (Mini), 2016
    ('jeff-suppan-mini-2016', 'cardinals'),                                                 -- Jeff Suppan (Mini), 2016
    ('jim-edmonds-mini-2016', 'cardinals'),                                                 -- Jim Edmonds (Mini), 2016
    ('john-tudor-mini-2015', 'cardinals'),                                                  -- John Tudor (Mini), 2015
    ('ken-dayley-mini-2015', 'cardinals'),                                                  -- Ken Dayley (Mini), 2015
    ('lance-berkman-mini-2015', 'cardinals'),                                               -- Lance Berkman (Mini), 2015
    ('lou-brock-mini-2017', 'cardinals'),                                                   -- Lou Brock (Mini), 2017
    ('ozzie-smith-mini-2017', 'cardinals'),                                                 -- Ozzie Smith (Mini), 2017
    ('randy-flores-mini-2016', 'cardinals'),                                                -- Randy Flores (Mini), 2016
    ('red-schoendienst-mini-2017', 'cardinals'),                                            -- Red Schoendienst (Mini), 2017
    ('scott-terry-mini-2017', 'cardinals'),                                                 -- Scott Terry (Mini), 2017
    ('tito-landrum-mini-2015', 'cardinals'),                                                -- Tito Landrum (Mini), 2015
    ('todd-worrell-mini-2015', 'cardinals'),                                                -- Todd Worrell (Mini), 2015
    ('tom-lawless-mini-2017', 'cardinals'),                                                 -- Tom Lawless (Mini), 2017
    ('tom-pagnozzi-mini-2017', 'cardinals'),                                                -- Tom Pagnozzi (Mini), 2017
    ('tony-la-russa-mini-2016', 'cardinals'),                                               -- Tony La Russa (Mini), 2016
    ('vince-coleman-mini-2015', 'cardinals'),                                               -- Vince Coleman (Mini), 2015
    ('whitey-herzog-mini-2015', 'cardinals'),                                               -- Whitey Herzog (Mini), 2015
    ('whitey-herzog-mini-2017', 'cardinals'),                                               -- Whitey Herzog (Mini), 2017
    ('willie-mcgee-mini-2015', 'cardinals'),                                                -- Willie McGee (Mini), 2015
    ('hello-kitty-mini-2013', 'dodgers'),                                                   -- Hello Kitty Mini, 2013
    ('hello-kitty-mini-2014', 'dodgers'),                                                   -- Hello Kitty Mini, 2014
    ('hello-kitty-mini-dodger-stadium-50th-anniversary-2012', 'dodgers'),                   -- Hello Kitty Mini Dodger Stadium 50th Anniversary, 2012
    ('jhonny-peralta-mini-2008', 'guardians'),                                              -- Jhonny Peralta (Mini), 2008
    ('jody-gerut-mini-2004', 'guardians'),                                                  -- Jody Gerut (Mini), 2004
    ('travis-hafner-mini-2008', 'guardians'),                                               -- Travis Hafner (Mini), 2008
    ('aj-burnett-mini-2005', 'marlins'),                                                    -- A.J. Burnett (Mini), 2005
    ('community-marlins-dontrelle-willis-marlins-legends-hof-mini--c85b77f2', 'marlins'),   -- Dontrelle Willis (Marlins Legends Hall of Fame - Mini) [community]
    ('community-marlins-hula-billy-mini--ab62a2ef', 'marlins'),                             -- Hula Billy (Mini) [community]
    ('community-marlins-javier-sanoja-3273270b', 'marlins'),                                -- Javier Sanoja (Gold Glove - Mini) [community]
    ('community-marlins-josh-beckett-marlins-legends-hof-mini--99ababb8', 'marlins'),       -- Josh Beckett (Marlins Legends Hall of Fame - Mini) [community]
    ('community-marlins-martin-prado-mini-all-star-fanfest--8c6d4050', 'marlins'),          -- Martin Prado (All-Star FanFest - Mini) [community]
    ('dan-uggla-mini-2007', 'marlins'),                                                     -- Dan Uggla (Mini), 2007
    ('miguel-cabrera-mini-2005', 'marlins'),                                                -- Miguel Cabrera (Mini), 2005
    ('adam-jones-mini-2010', 'orioles'),                                                    -- Adam Jones (Mini), 2010
    ('nick-markakis-mini-2010', 'orioles'),                                                 -- Nick Markakis (Mini), 2010
    ('nolan-reimold-mini-2010', 'orioles'),                                                 -- Nolan Reimold (Mini), 2010
    ('bruce-bochy-jake-peavy-shawn-green-mini-set-2006', 'padres'),                         -- Bruce Bochy, Jake Peavy & Shawn Green (Mini Set), 2006
    ('community-padres-bruce-bochy-a2081319', 'padres'),                                    -- Bruce Bochy (Mini Magnet) [community]
    ('community-padres-don-orsillo-mark-grant-f6412235', 'padres'),                         -- Don Orsillo & Mark Grant (Mini Yacht) [community]
    ('community-padres-jake-peavy-224b82a9', 'padres'),                                     -- Jake Peavy (Mini Magnet) [community]
    ('community-padres-khalil-greene-c1c67f31', 'padres'),                                  -- Khalil Greene (Mini Magnet) [community]
    ('jalapeno-hannah-mini-2004', 'pirates'),                                               -- "Jalapeno Hannah" (Mini), 2004
    ('sauerkraut-saul-mini-2004', 'pirates'),                                               -- "Sauerkraut Saul" (Mini), 2004
    ('aubrey-huff-mini-2003', 'rays'),                                                      -- Aubrey Huff (Mini), 2003
    ('aubrey-huff-mini-2004', 'rays'),                                                      -- Aubrey Huff (Mini), 2004
    ('carl-crawford-mini-2003', 'rays'),                                                    -- Carl Crawford (Mini), 2003
    ('carl-crawford-mini-2004', 'rays'),                                                    -- Carl Crawford (Mini), 2004
    ('don-zimmer-mini-2004', 'rays'),                                                       -- Don Zimmer (Mini), 2004
    ('donald-duck-mini-disney-2008', 'rays'),                                               -- Donald Duck (Mini, Disney), 2008
    ('goofy-mini-disney-2008', 'rays'),                                                     -- Goofy (Mini, Disney), 2008
    ('jose-cruz-jr-mini-2004', 'rays'),                                                     -- Jose Cruz Jr. (Mini), 2004
    ('lou-piniella-mini-2004', 'rays'),                                                     -- Lou Piniella (Mini), 2004
    ('mickey-mouse-mini-disney-2008', 'rays'),                                              -- Mickey Mouse (Mini, Disney), 2008
    ('rocco-baldelli-mini-2003', 'rays'),                                                   -- Rocco Baldelli (Mini), 2003
    ('rocco-baldelli-mini-2004', 'rays'),                                                   -- Rocco Baldelli (Mini), 2004
    ('tino-martinez-mini-2004', 'rays'),                                                    -- Tino Martinez (Mini), 2004
    ('toby-hall-mini-2004', 'rays'),                                                        -- Toby Hall (Mini), 2004
    ('community-royals-mini-bobby-witt-jr--0b7964b2', 'royals'),                            -- Mini Bobby Witt Jr. (Big League Pack) [community]
    ('justin-verlander-april-in-the-d-mini-2013', 'tigers'),                                -- Justin Verlander ("April in the D" Mini), 2013
    ('miguel-cabrera-mini-2013', 'tigers'),                                                 -- Miguel Cabrera (Mini), 2013
    ('cc-sabathia-mini-2010', 'yankees')                                                    -- CC Sabathia (Mini), 2010
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('duos', 'Duos')
on conflict (slug) do nothing;

-- Duos -- 112 listings.
-- Two figures on one base. Taken from an explicit Dual/Double/Duo, or from a title naming exactly two people. Jonathan Lucroy's "Doubles Record" is a hitting record, and "Mike Trout /
-- Ducks" is an NHL crossover night rather than two people; neither is here.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'duos'
from (
  values
    ('mike-trout-albert-pujols-hr-2016', 'angels'),                                                   -- Mike Trout & Albert Pujols (HR), 2016
    ('mike-trout-mvp-double-2017', 'angels'),                                                         -- Mike Trout (MVP Double), 2017
    ('mike-trout-shohei-ohtani-city-connect-2023', 'angels'),                                         -- Mike Trout & Shohei Ohtani (City Connect), 2023
    ('shohei-ohtani-double-2018', 'angels'),                                                          -- Shohei Ohtani (Double), 2018
    ('altuve-kemp-hugs-for-homers-2019', 'astros'),                                                   -- Altuve & Kemp Hugs for Homers, 2019
    ('bill-brown-jim-deshaies-dual-in-the-booth-2011', 'astros'),                                     -- Bill Brown, Jim Deshaies Dual in the Booth, 2011
    ('carlos-correa-mandalorian-grogu-2026', 'astros'),                                               -- Carlos Correa Mandalorian & Grogu, 2026
    ('community-astros-carlos-correa-the-mandalorian-and-grogu--c3c93306', 'astros'),                 -- Carlos Correa “ The Mandalorian and Grogu” [community]
    ('josh-reddick-chewbaca-2018', 'astros'),                                                         -- Josh Reddick & Chewbaca, 2018
    ('mauricio-dubon-dogs-2025', 'astros'),                                                           -- Mauricio Dubon & Dogs, 2025
    ('milo-hamilton-alan-ashby-in-the-booth-2003', 'astros'),                                         -- Milo Hamilton, Alan Ashby In the Booth, 2003
    ('nolan-ryan-reid-ryan-2014', 'astros'),                                                          -- Nolan Ryan & Reid Ryan, 2014
    ('verlander-dog-2024', 'astros'),                                                                 -- Verlander & Dog, 2024
    ('matt-olson-chewbacca-2018', 'athletics'),                                                       -- Matt Olson & Chewbacca, 2018
    ('miguel-tejada-barry-zito-2017', 'athletics'),                                                   -- Miguel Tejada & Barry Zito, 2017
    ('corey-koskie-bj-ryan-flex-pack-2006', 'blue-jays'),                                             -- Corey Koskie & B.J. Ryan (Flex Pack), 2006
    ('jordan-romano-kenley-jansen-handshake-2023', 'blue-jays'),                                      -- Jordan Romano & Kenley Jansen (Handshake), 2023
    ('jose-bautista-edwin-encarnacion-2026', 'blue-jays'),                                            -- Jose Bautista & Edwin Encarnacion, 2026
    ('roy-halladay-carlos-delgado-7-game-flex-pack-2004', 'blue-jays'),                               -- Roy Halladay & Carlos Delgado (7-Game Flex Pack), 2004
    ('snoopy-woodstock-doghouse-2022', 'blue-jays'),                                                  -- Snoopy & Woodstock (Doghouse), 2022
    ('vladimir-guerrero-sr-jr-dual-2022', 'blue-jays'),                                               -- Vladimir Guerrero Sr. & Jr. (Dual), 2022
    ('chipper-jones-freddie-freeman-atv-2016', 'braves'),                                             -- Chipper Jones & Freddie Freeman (ATV), 2016
    ('freddie-freeman-jonny-gomes-hugging-2015', 'braves'),                                           -- Freddie Freeman & Jonny Gomes (Hugging), 2015
    ('michael-harris-ii-cash-2026', 'braves'),                                                        -- Michael Harris II & "Cash", 2026
    ('skip-caray-pete-van-wieren-famous-calls-2016', 'braves'),                                       -- Skip Caray & Pete Van Wieren ("Famous Calls"), 2016
    ('spencer-strider-kipnis-2025', 'braves'),                                                        -- Spencer Strider & Kipnis, 2025
    ('adam-wainwright-yadier-molina-dual-2016', 'cardinals'),                                         -- Adam Wainwright & Yadier Molina (Dual), 2016
    ('cardinals-ham-squints-2018', 'cardinals'),                                                      -- Cardinals Ham / Squints, 2018
    ('carlos-martinez-matt-carpenter-double-2017', 'cardinals'),                                      -- Carlos Martinez & Matt Carpenter (Double), 2017
    ('fredbird-big-bird-2022', 'cardinals'),                                                          -- Fredbird & Big Bird, 2022
    ('fredbird-louie-dual-2018', 'cardinals'),                                                        -- Fredbird & Louie (Dual), 2018
    ('joe-magrane-greg-mathews-2017', 'cardinals'),                                                   -- Joe Magrane & Greg Mathews, 2017
    ('kmox-dual-2019', 'cardinals'),                                                                  -- KMOX (Dual), 2019
    ('stan-musial-red-schoendienst-double-2019', 'cardinals'),                                        -- Stan Musial & Red Schoendienst (Double), 2019
    ('tommy-edman-lars-nootbaar-double-2023', 'cardinals'),                                           -- Tommy Edman & Lars Nootbaar (Double), 2023
    ('yadier-molina-albert-pujols-mystery-pitching-2023', 'cardinals'),                               -- Yadier Molina & Albert Pujols (Mystery Pitching), 2023
    ('yadier-molina-roberto-clemente-double-2019', 'cardinals'),                                      -- Yadier Molina & Roberto Clemente (Double), 2019
    ('boog-jd-talking-2023', 'cubs'),                                                                 -- Boog & JD (Talking), 2023
    ('dansby-mallory-swanson-2025', 'cubs'),                                                          -- Dansby & Mallory Swanson, 2025
    ('alston-lasorda-hall-of-fame-managers-dual-2012', 'dodgers'),                                    -- Alston/Lasorda Hall of Fame Managers Dual, 2012
    ('don-drysdale-maury-wills-cy-young-dual-2012', 'dodgers'),                                       -- Don Drysdale & Maury Wills Cy Young Dual, 2012
    ('james-outman-miguel-vargas-2023', 'dodgers'),                                                   -- James Outman & Miguel Vargas, 2023
    ('mookie-betts-game-7-double-play-2026', 'dodgers'),                                              -- Mookie Betts (Game 7 Double Play), 2026
    ('reese-roy-campanella-campy-night-2014', 'dodgers'),                                             -- Reese & Roy Campanella Campy Night, 2014
    ('brandon-belt-brandon-crawford-2014', 'giants'),                                                 -- Brandon Belt / Brandon Crawford, 2014
    ('community-giants-zito-vogelsong-trolly-3902ee3e', 'giants'),                                    -- Zito/Vogelsong Trolly (2012 Team Reunion VIP) [community]
    ('kirk-rueter-woody-luxo-ball-2019', 'giants'),                                                   -- Kirk Rueter (Woody) & Luxo Ball, 2019
    ('lou-seal-sj-sharkie-zamboni-2019', 'giants'),                                                   -- Lou Seal & SJ Sharkie Zamboni, 2019
    ('murph-and-mac-dual-2015', 'giants'),                                                            -- Murph and Mac (Dual), 2015
    ('c-c-sabathia-josh-bard-2003', 'guardians'),                                                     -- C.C. Sabathia, Josh Bard, 2003
    ('omar-vizquel-dave-concepcion-2004', 'guardians'),                                               -- Omar Vizquel, Dave Concepcion, 2004
    ('slider-gapper-double-mascots-2007', 'guardians'),                                               -- Slider/Gapper Double (Mascots), 2007
    ('ichiro-dual-2017', 'mariners'),                                                                 -- Ichiro (Dual), 2017
    ('ken-griffey-jr-ichiro-suzuki-double-2010', 'mariners'),                                         -- Ken Griffey Jr. & Ichiro Suzuki (Double), 2010
    ('mike-cameron-mark-mclemore-dual-2011', 'mariners'),                                             -- Mike Cameron & Mark McLemore (Dual), 2011
    ('randy-johnson-dan-wilson-dual-2012', 'mariners'),                                               -- Randy Johnson & Dan Wilson (Dual), 2012
    ('jon-snow-tom-koehler-game-of-thrones-2017', 'marlins'),                                         -- Jon Snow / Tom Koehler (Game of Thrones), 2017
    ('vintage-marlin-boy-face-2000', 'marlins'),                                                      -- "Vintage Marlin" / Boy Face, 2000
    ('ralph-kiner-bob-murphy-2003', 'mets'),                                                          -- Ralph Kiner & Bob Murphy, 2003
    ('sparky-mr-met-2022', 'mets'),                                                                   -- Sparky & Mr. Met, 2022
    ('daniel-murphy-tanner-roark-2018', 'nationals'),                                                 -- Daniel Murphy / Tanner Roark, 2018
    ('screech-teddy-2025', 'nationals'),                                                              -- Screech & Teddy, 2025
    ('crush-davis-samson-2016', 'orioles'),                                                           -- Crush Davis & Samson, 2016
    ('earl-weaver-jim-palmer-2004', 'orioles'),                                                       -- Earl Weaver & Jim Palmer, 2004
    ('ant-man-and-the-wasp-2018', 'padres'),                                                          -- Ant-Man and The Wasp, 2018
    ('community-padres-don-orsillo-mark-grant-f6412235', 'padres'),                                   -- Don Orsillo & Mark Grant (Mini Yacht) [community]
    ('community-padres-fernando-tatis-jr--55b34312', 'padres'),                                       -- Fernando Tatis, Jr. (Nando Calrissian) [community]
    ('community-padres-fernando-tatis-jr--b9ff5ffe', 'padres'),                                       -- Fernando Tatis, Jr. (City Connect 2) [community]
    ('don-orsillo-mark-grant-don-and-mud-2023', 'padres'),                                            -- Don Orsillo & Mark Grant (Don and Mud), 2023
    ('joe-musgrove-dog-theo-2024', 'padres'),                                                         -- Joe Musgrove & Dog Theo, 2024
    ('harry-kalas-richie-ashburn-dual-2002', 'phillies'),                                             -- Harry Kalas & Richie Ashburn (Dual), 2002
    ('phil-phillis-original-mascots-2003', 'phillies'),                                               -- Phil & Phillis (Original Mascots), 2003
    ('fire-ice-gonzalez-perez-2006', 'pirates'),                                                      -- "Fire & Ice" (Gonzalez & Perez), 2006
    ('jack-wilson-jose-castillo-double-2006', 'pirates'),                                             -- Jack Wilson & Jose Castillo (Double), 2006
    ('steve-blass-dual-player-broadcaster-2019', 'pirates'),                                          -- Steve Blass (Dual Player/Broadcaster), 2019
    ('ian-kinsler-double-play-2-of-2-2007', 'rangers'),                                               -- Ian Kinsler Double Play (2 of 2), 2007
    ('josh-sborz-jonah-heim-final-out-2025', 'rangers'),                                              -- Josh Sborz / Jonah Heim (Final Out), 2025
    ('julio-franco-michael-young-double-figurine-2006', 'rangers'),                                   -- Julio Franco/Michael Young (Double Figurine), 2006
    ('michael-young-double-play-1-of-2-2007', 'rangers'),                                             -- Michael Young Double Play (1 of 2), 2007
    ('mike-minor-lance-lynn-dueling-aces-2020', 'rangers'),                                           -- Mike Minor / Lance Lynn (Dueling Aces), 2020
    ('neftali-feliz-bengie-molina-dual-top-moments-hello-al-pennant-the-last-out-2019', 'rangers'),   -- Neftali Feliz/Bengie Molina Dual (Top Moments - Hello AL Pennant The Last Out), 2019
    ('dewayne-staats-joe-magrane-talking-double-2006', 'rays'),                                       -- DeWayne Staats & Joe Magrane (Talking, Double), 2006
    ('fred-mcgriff-tino-martinez-2018', 'rays'),                                                      -- Fred McGriff & Tino Martinez, 2018
    ('jake-bauers-willy-adames-double-season-ticket-holders-2019', 'rays'),                           -- Jake Bauers & Willy Adames (Double, Season Ticket Holders), 2019
    ('matt-duffy-double-play-2017', 'rays'),                                                          -- Matt Duffy (Double Play), 2017
    ('raymond-dj-kitty-double-2016', 'rays'),                                                         -- Raymond & DJ Kitty (Double), 2016
    ('wally-tessie-2016', 'red-sox'),                                                                 -- Wally & Tessie, 2016
    ('barry-larkin-dual-2021', 'reds'),                                                               -- Barry Larkin (Dual), 2021
    ('brandon-phillips-dual-30-30-2008', 'reds'),                                                     -- Brandon Phillips (Dual, 30/30), 2008
    ('homer-bailey-dual-no-hitter-2014', 'reds'),                                                     -- Homer Bailey (Dual No-Hitter), 2014
    ('hunter-greene-ross-2025', 'reds'),                                                              -- Hunter Greene & Ross, 2025
    ('ken-griffey-jr-dual-2016', 'reds'),                                                             -- Ken Griffey Jr. (Dual), 2016
    ('marty-brennaman-joe-nuxhall-dual-2003', 'reds'),                                                -- Marty Brennaman & Joe Nuxhall (Dual), 2003
    ('radio-broadcasters-double-2004', 'rockies'),                                                    -- Radio Broadcasters (Double), 2004
    ('community-royals-bobby-witt-jr-double-21767160', 'royals'),                                     -- Bobby Witt Jr. Double (20/20 Season) [community]
    ('community-royals-bret-saberhagen-and-salvador-perez-3d1e9299', 'royals'),                       -- Bret Saberhagen and Salvador Perez (World Series MVPs) [community]
    ('community-royals-elephant-piggie-day-827ca879', 'royals'),                                      -- Elephant & Piggie Day [community]
    ('george-brett-bret-saberhagen-1985-championship-2025', 'royals'),                                -- George Brett & Bret Saberhagen (1985 Championship, Theme Ticket), 2025
    ('nicky-lopez-vinnie-pasquantino-double-2023', 'royals'),                                         -- Nicky Lopez & Vinnie Pasquantino (Double), 2023
    ('jim-thome-babe-dual-2018', 'twins'),                                                            -- Jim Thome & Babe (Dual), 2018
    ('joe-mauer-justin-morneau-double-2013', 'twins'),                                                -- Joe Mauer & Justin Morneau (Double), 2013
    ('kent-hrbek-kirby-puckett-legends-set-of-2-2011', 'twins'),                                      -- Kent Hrbek & Kirby Puckett ("Legends" Set of 2), 2011
    ('minnie-paul-shaking-hands-double-2010', 'twins'),                                               -- Minnie & Paul (Shaking Hands, Double), 2010
    ('ron-gant-kent-hrbek-dual-2011', 'twins'),                                                       -- Ron Gant & Kent Hrbek (Dual), 2011
    ('bobby-jenks-aj-pierzynski-2026', 'white-sox'),                                                  -- Bobby Jenks & A.J. Pierzynski, 2026
    ('community-white-sox-babe-ruth-and-al-simmons-1933-all-star-game-0a0e1688', 'white-sox'),        -- Babe Ruth and Al Simmons (1933 All Star Game) [community]
    ('eloy-jimenez-luis-robert-2022', 'white-sox'),                                                   -- Eloy Jimenez & Luis Robert, 2022
    ('ken-harrelson-darrin-jackson-2003', 'white-sox'),                                               -- Ken Harrelson & Darrin Jackson, 2003
    ('kyle-teel-edgar-quero-2026', 'white-sox'),                                                      -- Kyle Teel & Edgar Quero, 2026
    ('southpaw-tommy-hawk-2019', 'white-sox'),                                                        -- Southpaw & Tommy Hawk, 2019
    ('elephant-piggy-2024', 'yankees'),                                                               -- Elephant & Piggy, 2024
    ('john-sterling-suzyn-waldman-talking-2022', 'yankees')                                           -- John Sterling & Suzyn Waldman (Talking), 2022
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('triples', 'Triples')
on conflict (slug) do nothing;

-- Triples -- 20 listings.
-- Three figures. Mickey Mantle's Triple Crown is a batting feat, not a three-pack, and
-- "Red, White & Bobby" is wordplay on one Bobby Witt Jr.; neither is here.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'triples'
from (
  values
    ('biggio-bagwell-hampton-2017', 'astros'),                                        -- Biggio, Bagwell, Hampton, 2017
    ('community-astros-jeff-bagwell-craig-biggio-mike-hampton-8396523b', 'astros'),   -- Jeff Bagwell/Craig Biggio/Mike Hampton [community]
    ('correa-altuve-keuchel-council-2016', 'astros'),                                 -- Correa, Altuve, Keuchel Council, 2016
    ('hof-triple-2021', 'astros'),                                                    -- HOF Triple, 2021
    ('star-wars-triple-special-ticket-2023', 'astros'),                               -- Star Wars triple (Special Ticket), 2023
    ('carlos-delgado-jose-bautista-vernon-wells-trio-2016', 'blue-jays'),             -- Carlos Delgado, Jose Bautista & Vernon Wells (Trio), 2016
    ('dave-stieb-pat-hentgen-roy-halladay-trio-2016', 'blue-jays'),                   -- Dave Stieb, Pat Hentgen & Roy Halladay (Trio), 2016
    ('george-bell-lloyd-moseby-jesse-barfield-trio-2015', 'blue-jays'),               -- George Bell, Lloyd Moseby & Jesse Barfield (Trio), 2015
    ('roberto-alomar-paul-molitor-john-olerud-triple-2018', 'blue-jays'),             -- Roberto Alomar, Paul Molitor & John Olerud (Triple), 2018
    ('mv3-triple-2019', 'cardinals'),                                                 -- MV3 (Triple), 2019
    ('gary-cohen-ron-darling-keith-hernandez-triple-2010', 'mets'),                   -- Gary Cohen, Ron Darling & Keith Hernandez (Triple), 2010
    ('ryan-zimmerman-jayson-werth-howie-kendrick-2025', 'nationals'),                 -- Ryan Zimmerman, Jayson Werth & Howie Kendrick, 2025
    ('bruce-bochy-jake-peavy-shawn-green-mini-set-2006', 'padres'),                   -- Bruce Bochy, Jake Peavy & Shawn Green (Mini Set), 2006
    ('community-padres-zoe-rumi-mira-636ad7ad', 'padres'),                            -- Zoe, Rumi & Mira (KPop Demon Hunters) [community]
    ('fernando-tatis-jr-nala-pumba-2022', 'padres'),                                  -- Fernando Tatis Jr., Nala & Pumba, 2022
    ('nolan-ryan-george-w-hw-bush-2010-world-series-first-pitch-2021', 'rangers'),    -- Nolan Ryan, George W & HW Bush (2010 World Series First Pitch), 2021
    ('nasty-boys-commemorative-triple-2015', 'reds'),                                 -- Nasty Boys (Commemorative Triple), 2015
    ('queen-city-sluggers-triple-2021', 'reds'),                                      -- "Queen City Sluggers" (Triple), 2021
    ('triple-bobblehead-2017', 'reds'),                                               -- Triple Bobblehead, 2017
    ('rock-paper-scissors-2026', 'royals')                                            -- Rock, Paper, Scissors, 2026
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('quads', 'Quads')
on conflict (slug) do nothing;

-- Quads -- 5 listings.
-- Four figures: the Ghostbusters, the Dodgers' Garvey/Lopes/Russell/Cey infield, the Rangers' Franchise Four, and a Twins season-ticket set of four.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'quads'
from (
  values
    ('ghostbusters-quad-2016', 'brewers'),                                                 -- Ghostbusters (Quad), 2016
    ('garvey-lopes-russell-cey-quad-2012', 'dodgers'),                                     -- Garvey/Lopes/Russell/Cey Quad, 2012
    ('franchise-four-quad-2016', 'rangers'),                                               -- Franchise Four Quad, 2016
    ('brad-radke-torii-hunter-corey-koskie-ron-gardenhire-season-ticket-2004', 'twins'),   -- Brad Radke, Torii Hunter, Corey Koskie & Ron Gardenhire (Season Ticket), 2004
    ('mark-buehrle-jon-garland-freddy-garcia-jose-contreras-2025', 'white-sox')            -- Mark Buehrle, Jon Garland, Freddy Garcia & Jose Contreras, 2025
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What landed: MVP 36, Cy Young 24, Silver Slugger 17, Rookie of the Year 12, Batting Champion 8, Mini Bobbles 89, Duos 112, Triples 20, Quads 5.
select slug, label, listing_count from public.tag_counts order by listing_count desc, label;
-- Thirteen more tags across the catalog.
--
-- Where a tag has a keyword the sort is mechanical: a listing is tagged when
-- its own title or nickname says so, not when someone judged that it
-- qualified. That keeps the result auditable and reviewable against the
-- catalog. Where a judgment was unavoidable it is named in the tag's own note,
-- and Celebrity -- which has no keyword at all -- says plainly that it is a
-- best effort.
--
-- Idempotent. Needs the widened key from supabase/fix_bobblehead_tags_pk.sql.
-- Paste into the Supabase SQL editor.
--
-- Two tags from the vocabulary are deliberately absent. Crossover is skipped
-- until the narrower tags settle and it's clear what is actually left over --
-- Marvel and Peanuts, added here, are most of what it would have absorbed.
-- Bobblecard has nothing to tag: no listing in the catalog uses the word.

insert into public.tags (slug, label)
values ('dia-de-los-muertos', 'Día de los Muertos')
on conflict (slug) do nothing;

-- Día de los Muertos -- 27 listings.
-- Every explicit Día de los Muertos night, plus the 17 sugar skulls -- same holiday's iconography, folded in at the owner's call.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'dia-de-los-muertos'
from (
  values
    ('community-astros-orbit-sugarskull-f1b23cc4', 'astros'),          -- Orbit (Sugarskull) [community]
    ('sugar-skull-2022', 'astros'),                                    -- Sugar Skull, 2022
    ('sugar-skull-2023', 'astros'),                                    -- Sugar Skull, 2023
    ('sugar-skull-2025', 'astros'),                                    -- Sugar Skull, 2025
    ('sugarskull-2024', 'astros'),                                     -- Sugarskull, 2024
    ('sugar-skull-2018', 'athletics'),                                 -- Sugar Skull, 2018
    ('dia-de-los-bravos-2019', 'braves'),                              -- "Dia de Los Bravos", 2019
    ('cerveceros-sugar-skull-2019', 'brewers'),                        -- Cerveceros Sugar Skull, 2019
    ('sugar-skull-2018', 'brewers'),                                   -- Sugar Skull, 2018
    ('sugar-skull-2022', 'cardinals'),                                 -- Sugar Skull, 2022
    ('community-cubs-sugar-skull-144f6b7c', 'cubs'),                   -- Sugar Skull [community]
    ('community-cubs-sugar-skull-f568737c', 'cubs'),                   -- Sugar Skull [community]
    ('sugar-skull-2017', 'diamondbacks'),                              -- Sugar Skull, 2017
    ('community-dodgers-dia-de-los-dodgers-b2e22d8e', 'dodgers'),      -- Dia De Los Dodgers [community]
    ('dia-de-los-dodgers-game-1-special-promotion-2022', 'dodgers'),   -- Día De Los Dodgers Game 1 - Special Promotion, 2022
    ('dia-de-los-dodgers-game-2-special-promotion-2022', 'dodgers'),   -- Día De Los Dodgers Game 2 - Special Promotion, 2022
    ('dia-de-los-dodgers-special-promotion-2018', 'dodgers'),          -- Dia de Los Dodgers Special Promotion, 2018
    ('dia-de-los-dodgers-special-promotion-2019', 'dodgers'),          -- Día de Los Dodgers Special Promotion, 2019
    ('dia-de-los-dodgers-special-promotion-2021', 'dodgers'),          -- Dia de Los Dodgers Special Promotion, 2021
    ('dia-de-los-gigantes-2019', 'giants'),                            -- Dia de los Gigantes, 2019
    ('community-padres-sugar-skull--9417763a', 'padres'),              -- Sugar Skull (Blue Sugar Skull) [community]
    ('community-padres-sugar-skull-ab6d2a69', 'padres'),               -- Sugar Skull (Mariachi) [community]
    ('community-padres-sugar-skull-add6c923', 'padres'),               -- Sugar Skull (City Connect 1) [community]
    ('community-royals-dia-de-los-muertos-579a47a9', 'royals'),        -- Dia De Los Muertos [community]
    ('sugar-skull-2024', 'twins'),                                     -- Sugar Skull, 2024
    ('la-catrina-2023', 'white-sox'),                                  -- La Catrina, 2023
    ('sugar-skull-2021', 'white-sox')                                  -- Sugar Skull, 2021
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('game-of-thrones', 'Game of Thrones')
on conflict (slug) do nothing;

-- Game of Thrones -- 25 listings.
-- Bruce Lee's "Year of the Dragon" is the Chinese zodiac, not Westeros, and is excluded.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'game-of-thrones'
from (
  values
    ('charlie-morton-game-of-thrones-2018', 'astros'),                   -- Charlie Morton (Game of Thrones), 2018
    ('chris-devenski-dragon-2017', 'astros'),                            -- Chris Devenski (Dragon), 2017
    ('jake-marisnick-got-2019', 'astros'),                               -- Jake Marisnick (GOT), 2019
    ('bernie-brewer-iron-throne-2017', 'brewers'),                       -- Bernie Brewer (Iron Throne), 2017
    ('corey-knebel-king-in-the-north-2018', 'brewers'),                  -- Corey Knebel ("King in the North"), 2018
    ('community-cubs-drogon-997fc8ee', 'cubs'),                          -- Drogon [community]
    ('game-of-thrones-2017', 'diamondbacks'),                            -- Taijuan Walker (Game of Thrones), 2017
    ('ice-dragon-2018', 'diamondbacks'),                                 -- Ice Dragon, 2018
    ('zack-godley-game-of-thrones-2019', 'diamondbacks'),                -- Zack Godley (Game of Thrones), 2019
    ('game-of-thrones-stadium-dragon-2019', 'giants'),                   -- Game of Thrones Stadium Dragon, 2019
    ('jon-snow-tom-koehler-game-of-thrones-2017', 'marlins'),            -- Jon Snow / Tom Koehler (Game of Thrones), 2017
    ('noah-syndergaard-game-of-thrones-2019', 'mets'),                   -- Noah Syndergaard (Game of Thrones), 2019
    ('michael-a-taylor-game-of-thrones-2018', 'nationals'),              -- Michael A. Taylor (Game of Thrones), 2018
    ('kevin-gausman-game-of-thrones-2018', 'orioles'),                   -- Kevin Gausman (Game of Thrones), 2018
    ('phanatic-iron-throne-2018', 'phillies'),                           -- Phanatic (Iron Throne), 2018
    ('jeff-bannister-game-of-thrones-house-banister-2017', 'rangers'),   -- Jeff Bannister (Game of Thrones - House Banister), 2017
    ('rougned-odor-game-of-thrones-rougned-hodor-2018', 'rangers'),      -- Rougned Odor (Game of Thrones - Rougned Hodor), 2018
    ('the-knight-king-game-of-thrones-night-2019', 'rangers'),           -- The Knight King (Game of Thrones Night), 2019
    ('willie-calhoun-game-of-thrones-calhoun-drogo-2021', 'rangers'),    -- Willie Calhoun (Game of Thrones Calhoun Drogo), 2021
    ('evan-longoria-game-of-thrones-2017', 'rays'),                      -- Evan Longoria (Game of Thrones), 2017
    ('andrew-benintendi-game-of-thrones-2017', 'red-sox'),               -- Andrew Benintendi (Game of Thrones), 2017
    ('ice-dragon-2019', 'royals'),                                       -- Ice Dragon, 2019
    ('ned-yost-iron-throne-2018', 'royals'),                             -- Ned Yost (Iron Throne), 2018
    ('jd-martinez-iron-thrones-2017', 'tigers'),                         -- J.D. Martinez ("Iron Thrones"), 2017
    ('southpaw-game-of-thrones-2017', 'white-sox')                       -- Southpaw (Game of Thrones), 2017
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('hall-of-fame', 'Hall of Fame')
on conflict (slug) do nothing;

-- Hall of Fame -- 53 listings.
-- Listings naming an induction or a hall -- Cooperstown, team halls, and Dick Enberg's broadcasting HOF alike.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'hall-of-fame'
from (
  values
    ('vladimir-guerrero-hall-of-fame-2018', 'angels'),                                      -- Vladimir Guerrero (Hall of Fame), 2018
    ('andre-johnson-hof-2024', 'astros'),                                                   -- Andre Johnson (HOF), 2024
    ('craig-biggio-hall-of-fame-2015', 'astros'),                                           -- Craig Biggio (Hall of Fame), 2015
    ('hof-triple-2021', 'astros'),                                                          -- HOF Triple, 2021
    ('jeff-bagwell-hof-2017', 'astros'),                                                    -- Jeff Bagwell (HOF), 2017
    ('rollie-fingers-cooperstown-collection-unknown', 'athletics'),                         -- Rollie Fingers Cooperstown Collection, Unknown
    ('tony-la-russa-hall-of-fame-2014', 'athletics'),                                       -- Tony La Russa (Hall of Fame), 2014
    ('andruw-jones-hall-of-fame-2026', 'braves'),                                           -- Andruw Jones (Hall of Fame), 2026
    ('fred-mcgriff-hall-of-fame-2023', 'braves'),                                           -- Fred McGriff (Hall of Fame), 2023
    ('john-smoltz-hall-of-fame-2015', 'braves'),                                            -- John Smoltz (Hall of Fame), 2015
    ('mystery-hall-of-fame-car-parade-2022', 'cardinals'),                                  -- Mystery Hall of Fame Car Parade, 2022
    ('mystery-hall-of-fame-manager-2017', 'cardinals'),                                     -- Mystery Hall of Fame Manager, 2017
    ('mystery-hall-of-fame-opening-day-car-parade-2019', 'cardinals'),                      -- Mystery Hall of Fame (Opening Day Car Parade), 2019
    ('randy-johnson-hall-of-fame-2015', 'diamondbacks'),                                    -- Randy Johnson (Hall of Fame), 2015
    ('alston-lasorda-hall-of-fame-managers-dual-2012', 'dodgers'),                          -- Alston/Lasorda Hall of Fame Managers Dual, 2012
    ('gil-hodges-hall-of-fame-2022', 'dodgers'),                                            -- Gil Hodges Hall of Fame, 2022
    ('sandy-koufax-hall-of-fame-inductee-2012', 'dodgers'),                                 -- Sandy Koufax Hall of Fame Inductee, 2012
    ('tommy-lasorda-hall-of-fame-induction-2007', 'dodgers'),                               -- Tommy Lasorda Hall of Fame Induction, 2007
    ('hall-of-fame-inductee-2016', 'guardians'),                                            -- Hall of Fame Inductee, 2016
    ('edgar-martinez-hall-of-fame-2019', 'mariners'),                                       -- Edgar Martinez (Hall of Fame), 2019
    ('ken-griffey-jr-hall-of-fame-2013', 'mariners'),                                       -- Ken Griffey Jr. (Hall of Fame), 2013
    ('ken-griffey-jr-hall-of-fame-2016', 'mariners'),                                       -- Ken Griffey Jr. (Hall of Fame), 2016
    ('lou-piniella-hall-of-fame-2014', 'mariners'),                                         -- Lou Piniella (Hall of Fame), 2014
    ('community-marlins-dontrelle-willis-marlins-legends-hof-mini--c85b77f2', 'marlins'),   -- Dontrelle Willis (Marlins Legends Hall of Fame - Mini) [community]
    ('community-marlins-josh-beckett-marlins-legends-hof-mini--99ababb8', 'marlins'),       -- Josh Beckett (Marlins Legends Hall of Fame - Mini) [community]
    ('oriole-bird-hall-of-fame-2021', 'orioles'),                                           -- Oriole Bird (Hall of Fame), 2021
    ('oriole-bird-hall-of-fame-spring-training-2022', 'orioles'),                           -- Oriole Bird (Hall of Fame, Spring Training), 2022
    ('community-padres-dick-enberg-3617a564', 'padres'),                                    -- Dick Enberg (Broadcasting HOF) [community]
    ('ivan-pudge-rodriguez-baseball-hof-2017', 'rangers'),                                  -- Ivan "Pudge" Rodriguez (Baseball HOF), 2017
    ('vladimir-guerrero-hall-of-fame-2018', 'rangers'),                                     -- Vladimir Guerrero (Hall of Fame), 2018
    ('david-ortiz-hall-of-fame-2021', 'red-sox'),                                           -- David Ortiz (Hall of Fame), 2021
    ('cesar-geronimo-reds-hof-2012', 'reds'),                                               -- Cesar Geronimo (Reds HOF), 2012
    ('dan-driessen-reds-hof-2012', 'reds'),                                                 -- Dan Driessen (Reds HOF), 2012
    ('dave-concepcion-reds-hof-2012', 'reds'),                                              -- Dave Concepcion (Reds HOF), 2012
    ('george-foster-reds-hof-2012', 'reds'),                                                -- George Foster (Reds HOF), 2012
    ('joe-morgan-reds-hof-2012', 'reds'),                                                   -- Joe Morgan (Reds HOF), 2012
    ('johnny-bench-b-reds-hof-2011', 'reds'),                                               -- Johnny Bench "B" (Reds HOF), 2011
    ('johnny-bench-c-reds-hof-2011', 'reds'),                                               -- Johnny Bench "C" (Reds HOF), 2011
    ('johnny-bench-e-reds-hof-2011', 'reds'),                                               -- Johnny Bench "E" (Reds HOF), 2011
    ('johnny-bench-h-reds-hof-2011', 'reds'),                                               -- Johnny Bench "H" (Reds HOF), 2011
    ('johnny-bench-n-reds-hof-2011', 'reds'),                                               -- Johnny Bench "N" (Reds HOF), 2011
    ('ken-griffey-sr-reds-hof-2012', 'reds'),                                               -- Ken Griffey Sr. (Reds HOF), 2012
    ('marge-schott-reds-hof-2010', 'reds'),                                                 -- Marge Schott (Reds HOF), 2010
    ('larry-walker-hof-2021', 'rockies'),                                                   -- Larry Walker (Hall of Fame), 2021
    ('jeff-montgomery-hall-of-fame-series-2018', 'royals'),                                 -- Jeff Montgomery (Hall of Fame Series), 2018
    ('mike-sweeney-hall-of-fame-2015', 'royals'),                                           -- Mike Sweeney (Hall of Fame), 2015
    ('whitey-herzog-hall-of-fame-series-2020', 'royals'),                                   -- Whitey Herzog (Hall of Fame Series), 2020
    ('joe-nathan-hall-of-fame-2019', 'twins'),                                              -- Joe Nathan (Hall of Fame), 2019
    ('johan-santana-hall-of-fame-2018', 'twins'),                                           -- Johan Santana (Hall of Fame), 2018
    ('justin-morneau-hall-of-fame-2021', 'twins'),                                          -- Justin Morneau (Hall of Fame), 2021
    ('michael-cuddyer-hall-of-fame-2017', 'twins'),                                         -- Michael Cuddyer (Hall of Fame), 2017
    ('torii-hunter-hall-of-fame-2016', 'twins'),                                            -- Torii Hunter (Hall of Fame), 2016
    ('jim-thome-hall-of-fame-2018', 'white-sox')                                            -- Jim Thome (Hall of Fame), 2018
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('all-star', 'All-Star')
on conflict (slug) do nothing;

-- All-Star -- 36 listings.
-- All-Star Game selections, appearances and commemoratives.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'all-star'
from (
  values
    ('justin-duchscherer-all-star-2009', 'athletics'),                                           -- Justin Duchscherer (All-Star), 2009
    ('chipper-jones-2000-all-star-game-2016', 'braves'),                                         -- Chipper Jones (2000 All-Star Game), 2016
    ('chipper-jones-2000-all-star-game-2025', 'braves'),                                         -- Chipper Jones (2000 All-Star Game), 2025
    ('carlos-gomez-all-star-2015', 'brewers'),                                                   -- Carlos Gomez (All-Star), 2015
    ('al-leiter-1996-all-star-2016', 'marlins'),                                                 -- Al Leiter (1996 All-Star), 2016
    ('alex-gonzalez-1999-all-star-2016', 'marlins'),                                             -- Alex Gonzalez (1999 All-Star), 2016
    ('charles-johnson-1997-all-star-2016', 'marlins'),                                           -- Charles Johnson (1997 All-Star), 2016
    ('cliff-floyd-2001-all-star-2016', 'marlins'),                                               -- Cliff Floyd (2001 All-Star), 2016
    ('community-marlins-ivan-rodriguez-all-star-sunday--6dd793d9', 'marlins'),                   -- Ivan Rodriguez (All-Star Sunday) [community]
    ('community-marlins-martin-prado-mini-all-star-fanfest--8c6d4050', 'marlins'),               -- Martin Prado (All-Star FanFest - Mini) [community]
    ('dontrelle-willis-2005-all-star-2016', 'marlins'),                                          -- Dontrelle Willis (2005 All-Star), 2016
    ('edgar-renteria-1998-all-star-2016', 'marlins'),                                            -- Edgar Renteria (1998 All-Star), 2016
    ('jack-mckeon-2004-all-star-2016', 'marlins'),                                               -- Jack McKeon (2004 All-Star), 2016
    ('jeff-conine-1995-all-star-2016', 'marlins'),                                               -- Jeff Conine (1995 All-Star), 2016
    ('jim-leyland-1998-all-star-2016', 'marlins'),                                               -- Jim Leyland (1998 All-Star), 2016
    ('kevin-brown-1997-all-star-2016', 'marlins'),                                               -- Kevin Brown (1997 All-Star), 2016
    ('luis-castillo-2002-all-star-2016', 'marlins'),                                             -- Luis Castillo (2002 All-Star), 2016
    ('mike-lowell-2003-all-star-2016', 'marlins'),                                               -- Mike Lowell (2003 All-Star), 2016
    ('moises-alou-1997-all-star-2016', 'marlins'),                                               -- Moises Alou (1997 All-Star), 2016
    ('david-wright-all-star-2013', 'mets'),                                                      -- David Wright (All-Star), 2013
    ('dwight-gooden-all-star-2013', 'mets'),                                                     -- Dwight Gooden (All-Star), 2013
    ('tom-seaver-all-star-2013', 'mets'),                                                        -- Tom Seaver (All-Star), 2013
    ('jason-bay-2006-all-star-2007', 'pirates'),                                                 -- Jason Bay (2006 All-Star), 2007
    ('jason-bay-all-star-2006', 'pirates'),                                                      -- Jason Bay (All-Star), 2006
    ('ivan-pudge-rodriguez-top-moments-95-all-star-game-2019', 'rangers'),                       -- Ivan "Pudge" Rodriguez (Top Moments - '95 All-Star Game), 2019
    ('joey-gallo-2019-all-star-game-2021', 'rangers'),                                           -- Joey Gallo (2019 All-Star Game), 2021
    ('2015-all-star-player-figurine-2015', 'reds'),                                              -- 2015 All-Star Player (Figurine), 2015
    ('commemorative-2015-all-star-2014', 'reds'),                                                -- Commemorative 2015 All-Star, 2014
    ('german-marquez-all-star-2022', 'rockies'),                                                 -- German Marquez (2021 All-Star Game), 2022
    ('community-royals-eric-hosmer-1c4ae9cf', 'royals'),                                         -- Eric Hosmer (All-Star MVP) [community]
    ('community-royals-salvador-perez-63988669', 'royals'),                                      -- Salvador Perez (All-Star Game Starter) [community]
    ('glen-perkins-2014-all-star-game-2014', 'twins'),                                           -- Glen Perkins (2014 All-Star Game), 2014
    ('harmon-killebrew-1965-all-star-game-2014', 'twins'),                                       -- Harmon Killebrew (1965 All-Star Game), 2014
    ('snoopy-all-star-game-figurine-2014', 'twins'),                                             -- Snoopy (All-Star Game Figurine), 2014
    ('tom-brunansky-1985-all-star-game-2014', 'twins'),                                          -- Tom Brunansky (1985 All-Star Game), 2014
    ('community-white-sox-babe-ruth-and-al-simmons-1933-all-star-game-0a0e1688', 'white-sox')    -- Babe Ruth and Al Simmons (1933 All Star Game) [community]
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('record-holder-breaker', 'Record Holder/Breaker')
on conflict (slug) do nothing;

-- Record Holder/Breaker -- 37 listings.
-- No-hitters, perfect games, cycles and career milestones. Read as feats-and-milestones; "record" alone would leave about five.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'record-holder-breaker'
from (
  values
    ('albert-pujols-3000-hits-2018', 'angels'),                         -- Albert Pujols (3,000 Hits), 2018
    ('shohei-ohtani-cycle-2021', 'angels'),                             -- Shohei Ohtani (Cycle), 2021
    ('altuve-cycle-2024', 'astros'),                                    -- Jose Altuve (Cycle), 2024
    ('craig-biggio-batting-3000th-career-hit-2012', 'astros'),          -- Craig Biggio (Batting 3000th Career Hit), 2012
    ('framber-consecutive-start-2023', 'astros'),                       -- Framber Valdez (Consecutive Start), 2023
    ('framber-no-hitter-2024', 'astros'),                               -- Framber Valdez (No Hitter), 2024
    ('mike-scott-no-hitter-2012', 'astros'),                            -- Mike Scott (No Hitter), 2012
    ('nolan-ryan-5th-no-hitter-2012', 'astros'),                        -- Nolan Ryan (’5th No Hitter’), 2012
    ('yordan-alvarez-cycle-2025', 'astros'),                            -- Yordan Alvarez (Cycle), 2025
    ('mike-fiers-no-hitter-2019', 'athletics'),                         -- Mike Fiers (No-Hitter), 2019
    ('sean-manaea-no-hitter-2018', 'athletics'),                        -- Sean Manaea (No-Hitter), 2018
    ('jonathan-lucroy-doubles-record-2015', 'brewers'),                 -- Jonathan Lucroy (Doubles Record), 2015
    ('nolan-arenado-cycle-2023', 'cardinals'),                          -- Nolan Arenado (Cycle), 2023
    ('carlos-zambrano-no-hitter-statue-2009', 'cubs'),                  -- Carlos Zambrano (No-Hitter Statue), 2009
    ('greg-maddux-3-000th-strikeout-2014', 'cubs'),                     -- Greg Maddux (3,000th Strikeout), 2014
    ('aaron-hill-bicycle-2013', 'diamondbacks'),                        -- Aaron Hill (#BiCycle), 2013
    ('clayton-kershaw-3000-strikeouts-2025', 'dodgers'),                -- Clayton Kershaw (3000 Strikeouts), 2025
    ('clayton-kershaw-no-hitter-5-year-anniversary-2019', 'dodgers'),   -- Clayton Kershaw No Hitter 5-Year Anniversary, 2019
    ('fernando-valenzuela-no-hitter-june-29-1990-2012', 'dodgers'),     -- Fernando Valenzuela No-Hitter June 29, 1990, 2012
    ('sandy-koufax-perfect-game-2015', 'dodgers'),                      -- Sandy Koufax Perfect Game, 2015
    ('jonathan-sanchez-no-hitter-2010', 'giants'),                      -- Jonathan Sanchez (No-Hitter), 2010
    ('felix-hernandez-perfect-game-2013', 'mariners'),                  -- Felix Hernandez ("Perfect Game"), 2013
    ('jordan-zimmermann-no-hitter-2015', 'nationals'),                  -- Jordan Zimmermann (No-Hitter), 2015
    ('max-scherzer-no-hitter-1-2016', 'nationals'),                     -- Max Scherzer (No-Hitter, #1), 2016
    ('max-scherzer-no-hitter-2-2016', 'nationals'),                     -- Max Scherzer (No-Hitter, #2), 2016
    ('community-padres-wil-myers-640ed77d', 'padres'),                  -- Wil Myers (Cycle) [community]
    ('trevor-hoffman-500th-save-2018', 'padres'),                       -- Trevor Hoffman (500th Save), 2018
    ('yu-darvish-3-000-strikeouts-2023', 'padres'),                     -- Yu Darvish (3,000 Strikeouts), 2023
    ('adrian-beltre-top-moments-the-3-000th-hit-2019', 'rangers'),      -- Adrian Beltre (Top Moments - The 3,000th Hit), 2019
    ('kenny-rogers-top-moments-the-perfect-game-2019', 'rangers'),      -- Kenny Rogers (Top Moments - The Perfect Game), 2019
    ('wyatt-langford-cycle-2025', 'rangers'),                           -- Wyatt Langford (Cycle), 2025
    ('homer-bailey-dual-no-hitter-2014', 'reds'),                       -- Homer Bailey (Dual No-Hitter), 2014
    ('ken-griffey-jr-500th-home-run-2014', 'reds'),                     -- Ken Griffey Jr. (500th Home Run), 2014
    ('tom-browning-perfect-game-2008', 'reds'),                         -- Tom Browning (Perfect Game), 2008
    ('nolan-arenado-walk-off-cycle-2018', 'rockies'),                   -- Nolan Arenado (Walk-Off Cycle), 2018
    ('community-royals-gold-bobby-witt-jr--6677b942', 'royals'),        -- Gold Bobby Witt Jr. (Record Breaker) [community]
    ('miggy-milestones-2023', 'tigers')                                 -- "Miggy Milestones" (Miguel Cabrera), 2023
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('legends', 'Legends')
on conflict (slug) do nothing;

-- Legends -- 15 listings.
-- Listings the team itself branded Legends -- the Dodgers' Legends of Dodger Baseball series and its equivalents.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'legends'
from (
  values
    ('carlos-beltran-legends-weekend-2018', 'astros'),                                      -- Carlos Beltran (Legends Weekend), 2018
    ('don-newcombe-legends-of-dodger-baseball-2019', 'dodgers'),                            -- Don Newcombe Legends of Dodger Baseball, 2019
    ('fernando-valenzuela-legends-of-dodger-baseball-2019', 'dodgers'),                     -- Fernando Valenzuela Legends of Dodger Baseball, 2019
    ('kirk-gibson-legends-of-dodger-baseball-2022', 'dodgers'),                             -- Kirk Gibson Legends of Dodger Baseball, 2022
    ('manny-mota-legends-of-dodger-baseball-2023', 'dodgers'),                              -- Manny Mota Legends of Dodger Baseball, 2023
    ('maury-wills-legends-of-dodger-baseball-2022', 'dodgers'),                             -- Maury Wills Legends of Dodger Baseball, 2022
    ('reggie-smith-legends-of-dodger-baseball-2026', 'dodgers'),                            -- Reggie Smith Legends of Dodger Baseball, 2026
    ('ron-cey-legends-of-dodger-baseball-2025', 'dodgers'),                                 -- Ron Cey Legends of Dodger Baseball, 2025
    ('steve-garvey-legends-of-dodger-baseball-2019', 'dodgers'),                            -- Steve Garvey Legends of Dodger Baseball, 2019
    ('community-marlins-dontrelle-willis-marlins-legends-hof-mini--c85b77f2', 'marlins'),   -- Dontrelle Willis (Marlins Legends Hall of Fame - Mini) [community]
    ('community-marlins-josh-beckett-marlins-legends-hof-mini--99ababb8', 'marlins'),       -- Josh Beckett (Marlins Legends Hall of Fame - Mini) [community]
    ('adrian-beltre-texas-legend-2021', 'rangers'),                                         -- Adrián Beltre (Texas Legend), 2021
    ('kent-hrbek-kirby-puckett-legends-set-of-2-2011', 'twins'),                            -- Kent Hrbek & Kirby Puckett ("Legends" Set of 2), 2011
    ('kent-hrbek-legends-of-the-dome-2009', 'twins'),                                       -- Kent Hrbek ("Legends of the Dome"), 2009
    ('kirby-puckett-legends-of-the-dome-2009', 'twins')                                     -- Kirby Puckett ("Legends of the Dome"), 2009
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('audio', 'Audio')
on conflict (slug) do nothing;

-- Audio -- 20 listings.
-- The ones that make noise: voice chips, talking broadcasters, sound modules.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'audio'
from (
  values
    ('bill-king-with-sound-season-ticket-holders-2003', 'athletics'),   -- Bill King (with Sound, Season Ticket Holders), 2003
    ('g-eazy-with-sound-2017', 'athletics'),                            -- G-Eazy (with sound), 2017
    ('bob-uecker-talking-2021', 'brewers'),                             -- Bob Uecker (Talking), 2021
    ('harry-caray-voice-chip-2015', 'cardinals'),                       -- Harry Caray (Voice Chip), 2015
    ('jack-buck-voice-chip-2014', 'cardinals'),                         -- Jack Buck (Voice Chip), 2014
    ('mike-shannon-voice-chip-2013', 'cardinals'),                      -- Mike Shannon (Voice Chip), 2013
    ('boog-jd-talking-2023', 'cubs'),                                   -- Boog & JD (Talking), 2023
    ('archie-bradley-audio-2018', 'diamondbacks'),                      -- Archie Bradley (Audio), 2018
    ('geraldo-perdomo-audio-2026', 'diamondbacks'),                     -- Geraldo Perdomo (Audio), 2026
    ('community-giants-e-40-vip-7bd91db4', 'giants'),                   -- E-40 VIP (Talking) [community]
    ('omar-vizquel-talking-2003', 'guardians'),                         -- Omar Vizquel (Talking), 2003
    ('howie-rose-sound-2023', 'mets'),                                  -- Howie Rose (Sound), 2023
    ('talking-chuck-2002', 'orioles'),                                  -- "Talking Chuck", 2002
    ('bob-prince-talking-2003', 'pirates'),                             -- Bob Prince (Talking), 2003
    ('dewayne-staats-joe-magrane-talking-double-2006', 'rays'),         -- DeWayne Staats & Joe Magrane (Talking, Double), 2006
    ('willy-adames-audio-2021', 'rays'),                                -- Willy Adames (Audio), 2021
    ('mookie-betts-time-to-party-with-sound-2019', 'red-sox'),          -- Mookie Betts ("Time to Party", with Sound), 2019
    ('denny-matthews-talking-2004', 'royals'),                          -- Denny Matthews (Talking), 2004
    ('eloy-jimenez-hi-mom-talking-2023', 'white-sox'),                  -- Eloy Jimenez ("Hi Mom!" Talking), 2023
    ('john-sterling-suzyn-waldman-talking-2022', 'yankees')             -- John Sterling & Suzyn Waldman (Talking), 2022
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('world-baseball-classic', 'World Baseball Classic')
on conflict (slug) do nothing;

-- World Baseball Classic -- 4 listings.
-- Four listings, two of them 2026 community submissions.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'world-baseball-classic'
from (
  values
    ('kike-hernandez-wbc-2023', 'red-sox'),                              -- Kike Hernandez (WBC), 2023
    ('rafael-devers-wbc-2023', 'red-sox'),                               -- Rafael Devers (WBC), 2023
    ('community-white-sox-kyle-teel-wbc-italy-399fd212', 'white-sox'),   -- Kyle Teel (WBC Italy) [community]
    ('community-white-sox-munetaka-murakami-9096bbd2', 'white-sox')      -- Munetaka Murakami (WBC Japan) [community]
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('disney', 'Disney')
on conflict (slug) do nothing;

-- Disney -- 10 listings.
-- Disney-branded in its own right. Marvel and Star Wars are Disney-owned but deliberately not here -- corporate ownership isn't how anyone browses a shelf.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'disney'
from (
  values
    ('mickey-mouse-d23-2024', 'angels'),                  -- Mickey Mouse (D23), 2024
    ('mickey-mouse-d23-2026', 'angels'),                  -- Mickey Mouse (D23), 2026
    ('donald-duck-mini-disney-2008', 'rays'),             -- Donald Duck (Mini, Disney), 2008
    ('goofy-mini-disney-2008', 'rays'),                   -- Goofy (Mini, Disney), 2008
    ('mickey-mouse-mini-disney-2008', 'rays'),            -- Mickey Mouse (Mini, Disney), 2008
    ('mickey-lolich-1968-2018', 'tigers'),                -- Mickey Lolich (1968), 2018
    ('minnie-paul-shaking-hands-double-2010', 'twins'),   -- Minnie & Paul (Shaking Hands, Double), 2010
    ('minnie-minoso-2002', 'white-sox'),                  -- Minnie Minoso, 2002
    ('mickey-mantle-2006', 'yankees'),                    -- Mickey Mantle, 2006
    ('mickey-mantle-triple-crown-2016', 'yankees')        -- Mickey Mantle (Triple Crown), 2016
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('marvel', 'Marvel')
on conflict (slug) do nothing;

-- Marvel -- 47 listings.
-- The Marvel nights, plus the players who got Marvel treatment -- Syndergaard as Thor, Rutschman and Jeter as Captain America, Orbit as "Thorbit".
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'marvel'
from (
  values
    ('community-astros-yordan-alvarez--3ca57387', 'astros'),                    -- Yordan Alvarez (Marvel Night - Spider-Man) [community]
    ('orbit-as-thor-aka-thorbit-2018', 'astros'),                               -- Orbit (as Thor aka Thorbit), 2018
    ('black-panther-2018', 'athletics'),                                        -- Black Panther, 2018
    ('captain-marvel-2023', 'athletics'),                                       -- Captain Marvel, 2023
    ('community-athletics-spider-man-special-ticket--7148ffc8', 'athletics'),   -- Spider-Man (Special Ticket) [community]
    ('groot-2023', 'athletics'),                                                -- Groot, 2023
    ('spider-man-2022', 'blue-jays'),                                           -- Spider-Man, 2022
    ('andruw-jones-spider-man-catch-2016', 'braves'),                           -- Andruw Jones (Spider-Man Catch), 2016
    ('captain-america-2018', 'brewers'),                                        -- Captain America, 2018
    ('iron-man-2017', 'brewers'),                                               -- Iron Man, 2017
    ('loki-2023', 'cubs'),                                                      -- Loki, 2023
    ('ant-man-2018', 'giants'),                                                 -- Ant-Man, 2018
    ('captain-america-2016', 'giants'),                                         -- Captain America, 2016
    ('giants-thor-2017', 'giants'),                                             -- Giants Thor, 2017
    ('hulk-2018', 'giants'),                                                    -- Hulk, 2018
    ('hulkbuster-2019', 'giants'),                                              -- Hulkbuster, 2019
    ('spider-man-2019', 'giants'),                                              -- Spider-Man, 2019
    ('hulk-2017', 'marlins'),                                                   -- Hulk, 2017
    ('noah-syndergaard-thor-2017', 'mets'),                                     -- Noah Syndergaard (Thor), 2017
    ('noah-syndergaard-thor-2018', 'mets'),                                     -- Noah Syndergaard (Thor), 2018
    ('spider-man-2019', 'mets'),                                                -- Spider-Man, 2019
    ('starling-marte-black-panther-2023', 'mets'),                              -- Starling Marte (Black Panther), 2023
    ('captain-america-2026', 'nationals'),                                      -- Captain America, 2026
    ('josh-bell-the-unstoppable-marvel-2022', 'nationals'),                     -- Josh Bell ("The Unstoppable", Marvel), 2022
    ('adley-rutschman-captain-america-2023', 'orioles'),                        -- Adley Rutschman (Captain America), 2023
    ('ant-man-and-the-wasp-2018', 'padres'),                                    -- Ant-Man and The Wasp, 2018
    ('community-padres-black-panther-20e28ba9', 'padres'),                      -- Black Panther (_) [community]
    ('community-padres-iron-man-a4e0dda8', 'padres'),                           -- Captain America (_) [community]
    ('iron-man-or-captain-america-2018', 'padres'),                             -- Iron Man or Captain America, 2018
    ('hulk-2018', 'phillies'),                                                  -- Hulk, 2018
    ('spider-man-2019', 'phillies'),                                            -- Spider-Man, 2019
    ('hulk-kids-2018', 'pirates'),                                              -- Hulk (Kids), 2018
    ('spider-man-2019', 'pirates'),                                             -- Spider-Man, 2019
    ('community-rangers-jjosh-jung-f1f2f463', 'rangers'),                       -- Josh Jung (Marvel - Captain America Bobblehead) [community]
    ('groot-2023', 'rays'),                                                     -- Groot, 2023
    ('iron-man-marvel-2017', 'rays'),                                           -- Iron Man (Marvel), 2017
    ('black-panther-2019', 'reds'),                                             -- Black Panther, 2019
    ('captain-america-2018', 'reds'),                                           -- Captain America, 2018
    ('iron-man-2017', 'reds'),                                                  -- Iron Man, 2017
    ('marvel-super-heroes-2017', 'rockies'),                                    -- Marvel Super Heroes, 2017
    ('captain-america-2017', 'royals'),                                         -- Captain America, 2017
    ('black-panther-2023', 'tigers'),                                           -- Black Panther, 2023
    ('paul-konerko-captain-america-2022', 'white-sox'),                         -- Paul Konerko (Captain America), 2022
    ('spider-man-2019', 'white-sox'),                                           -- Spider-Man, 2019
    ('white-sox-iron-man-2018', 'white-sox'),                                   -- White Sox Iron Man, 2018
    ('derek-jeter-captain-america-2023', 'yankees'),                            -- Derek Jeter (Captain America), 2023
    ('mariano-rivera-captain-america-2019', 'yankees')                          -- Mariano Rivera (Captain America), 2019
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('peanuts', 'Peanuts')
on conflict (slug) do nothing;

-- Peanuts -- 54 listings.
-- Snoopy across a dozen teams, plus Charlie Brown, Lucy, Linus, Woodstock and Schroeder. Bill Schroeder and Franklin Gutierrez matched the pattern and are people, not Peanuts.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'peanuts'
from (
  values
    ('snoopy-2010', 'angels'),                                 -- Snoopy, 2010
    ('charlie-brown-2025', 'astros'),                          -- Charlie Brown, 2025
    ('peanuts-special-ticket-2023', 'astros'),                 -- Peanuts (Special Ticket), 2023
    ('peanuts-special-ticket-2024', 'astros'),                 -- Peanuts (Special Ticket), 2024
    ('charlie-brown-2025', 'blue-jays'),                       -- Charlie Brown, 2025
    ('snoopy-woodstock-doghouse-2022', 'blue-jays'),           -- Snoopy & Woodstock (Doghouse), 2022
    ('brewers-themed-snoopy-2018', 'brewers'),                 -- Brewers-Themed Snoopy, 2018
    ('charlie-brown-2017', 'brewers'),                         -- Charlie Brown, 2017
    ('woodstock-2021', 'brewers'),                             -- Woodstock, 2021
    ('linus-2022', 'cardinals'),                               -- Linus, 2022
    ('schroeder-2023', 'cardinals'),                           -- Schroeder, 2023
    ('woodstock-2019', 'cardinals'),                           -- Woodstock, 2019
    ('charlie-brown-2005', 'giants'),                          -- Charlie Brown, 2005
    ('community-giants-lucy-b32a63a3', 'giants'),              -- Lucy (VIP Baseball Help) [community]
    ('community-giants-snoopy-241dc4e7', 'giants'),            -- Snoopy (Special Event) [community]
    ('giants-themed-peanuts-2022', 'giants'),                  -- Giants-Themed Peanuts, 2022
    ('joe-cool-snoopy-2007', 'giants'),                        -- "Joe Cool" Snoopy, 2007
    ('lucy-2023', 'giants'),                                   -- Lucy, 2023
    ('lucy-peanuts-2010', 'giants'),                           -- Lucy (Peanuts), 2010
    ('peanuts-woodstock-2019', 'giants'),                      -- Peanuts Woodstock, 2019
    ('snoopy-flying-ace-2021', 'giants'),                      -- Snoopy Flying Ace, 2021
    ('charlie-brown-2022', 'guardians'),                       -- Charlie Brown, 2022
    ('linus-2023', 'guardians'),                               -- Linus, 2023
    ('peanuts-lucy-2023', 'guardians'),                        -- Peanuts Lucy, 2023
    ('woodstock-2022', 'guardians'),                           -- Woodstock, 2022
    ('charlie-brown-2023', 'mariners'),                        -- Charlie Brown, 2023
    ('charlie-brown-2019', 'padres'),                          -- Charlie Brown, 2019
    ('community-padres-snoopy-64236d04', 'padres'),            -- Snoopy (Flying Ace) [community]
    ('community-padres-woodstock-d19522dc', 'padres'),         -- Woodstock [community]
    ('linus-2022', 'padres'),                                  -- Linus, 2022
    ('snoopy-2021', 'padres'),                                 -- Snoopy, 2021
    ('charlie-brown-50th-anniversary-2017', 'phillies'),       -- Charlie Brown (50th Anniversary), 2017
    ('linus-2019', 'phillies'),                                -- Linus, 2019
    ('lucy-2022', 'phillies'),                                 -- Lucy, 2022
    ('schroeder-peanuts-2021', 'phillies'),                    -- Schroeder (Peanuts), 2021
    ('snoopy-2018', 'phillies'),                               -- Snoopy, 2018
    ('charlie-brown-2003', 'pirates'),                         -- Charlie Brown, 2003
    ('charlie-brown-2017', 'pirates'),                         -- Charlie Brown, 2017
    ('snoopy-2004', 'pirates'),                                -- Snoopy, 2004
    ('community-rangers-charlie-brown-9b8627a1', 'rangers'),   -- Charlie Brown (Peanuts) [community]
    ('charlie-brown-2017', 'red-sox'),                         -- Charlie Brown, 2017
    ('snoopy-2018', 'red-sox'),                                -- Snoopy, 2018
    ('woodstock-peanuts-2019', 'red-sox'),                     -- Woodstock (Peanuts), 2019
    ('charlie-brown-2017', 'reds'),                            -- Charlie Brown, 2017
    ('snoopy-2018', 'reds'),                                   -- Snoopy, 2018
    ('woodstock-2019', 'reds'),                                -- Woodstock, 2019
    ('charlie-brown-2010', 'tigers'),                          -- Charlie Brown, 2010
    ('snoopy-2019', 'twins'),                                  -- Snoopy, 2019
    ('snoopy-all-star-game-figurine-2014', 'twins'),           -- Snoopy (All-Star Game Figurine), 2014
    ('charlie-brown-2013', 'yankees'),                         -- Charlie Brown, 2013
    ('lucy-peanuts-3rd-series-2014', 'yankees'),               -- Lucy (Peanuts, 3rd Series), 2014
    ('peanuts-2015', 'yankees'),                               -- Peanuts, 2015
    ('peanuts-5-2016', 'yankees'),                             -- Peanuts (#5), 2016
    ('snoopy-2012', 'yankees')                                 -- Snoopy, 2012
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('mascot', 'Mascot')
on conflict (slug) do nothing;

-- Mascot -- 164 listings.
-- Every named mascot, whether or not the listing says "mascot" -- Orbit, Fredbird, the Phanatic, the racing sausages. Silver Slugger awards, Bernie Williams, three different Clarks and Snoopy's Flying Ace all matched the pattern and are excluded.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'mascot'
from (
  values
    ('baby-rally-monkey-kids-2014', 'angels'),                               -- Baby Rally Monkey (Kids), 2014
    ('rally-monkey-2003', 'angels'),                                         -- Rally Monkey, 2003
    ('rally-monkey-2004', 'angels'),                                         -- Rally Monkey, 2004
    ('altuve-astro-for-life-sth-exclusive-2024', 'astros'),                  -- Jose Altuve (Astro for Life STH Exclusive), 2024
    ('community-astros-orbit-8d03b8bb', 'astros'),                           -- Orbit (Foul Pole) [community]
    ('community-astros-orbit-sugarskull-f1b23cc4', 'astros'),                -- Orbit (Sugarskull) [community]
    ('junction-jack-mascot-bobblebelly-2003', 'astros'),                     -- Junction Jack (Mascot Bobblebelly), 2003
    ('orbit-2024', 'astros'),                                                -- Orbit, 2024
    ('orbit-as-thor-aka-thorbit-2018', 'astros'),                            -- Orbit (as Thor aka Thorbit), 2018
    ('orbit-bobblebelly-2013', 'astros'),                                    -- Orbit (Bobblebelly), 2013
    ('orbit-city-connect-2025', 'astros'),                                   -- Orbit (City Connect), 2025
    ('orbit-pitching-2022', 'astros'),                                       -- Orbit (Pitching), 2022
    ('orbit-rainbow-jacket-2020', 'astros'),                                 -- Orbit (Rainbow Jacket), 2020
    ('orbit-wan-kenobi-bobblehead-2015', 'astros'),                          -- Orbit (Wan Kenobi Bobblehead), 2015
    ('orbit-ws-flag-2023', 'astros'),                                        -- Orbit (WS Flag), 2023
    ('stomper-mascot-kids-club-2005', 'athletics'),                          -- Stomper (Mascot, Kids Club), 2005
    ('ace-mascot-2007', 'blue-jays'),                                        -- Ace (Mascot), 2007
    ('blooper-2018', 'braves'),                                              -- BLOOPER, 2018
    ('blooper-bobblebody-2023', 'braves'),                                   -- BLOOPER (Bobblebody), 2023
    ('blooper-world-series-2022', 'braves'),                                 -- BLOOPER (World Series), 2022
    ('barrel-man-mascot-2008', 'brewers'),                                   -- Barrel Man (Mascot), 2008
    ('barrelman-2016', 'brewers'),                                           -- Barrelman, 2016
    ('barrelman-mascot-2009', 'brewers'),                                    -- Barrelman (Mascot), 2009
    ('bernie-brewer-2010', 'brewers'),                                       -- Bernie Brewer, 2010
    ('bernie-brewer-iron-throne-2017', 'brewers'),                           -- Bernie Brewer (Iron Throne), 2017
    ('bernie-brewer-paint-your-own-2016', 'brewers'),                        -- Bernie Brewer (Paint Your Own), 2016
    ('bernie-brewer-yarn-mini-2018', 'brewers'),                             -- Bernie Brewer (Yarn, Mini), 2018
    ('brat-sausage-2003', 'brewers'),                                        -- Brat Sausage, 2003
    ('bratwurst-racing-sausage-2009', 'brewers'),                            -- Bratwurst Racing Sausage, 2009
    ('chorizo-2014', 'brewers'),                                             -- Chorizo, 2014
    ('chorizo-mascot-2007', 'brewers'),                                      -- Chorizo (Mascot), 2007
    ('chorizo-mascot-2008', 'brewers'),                                      -- Chorizo (Mascot), 2008
    ('famous-racing-sausage-2018', 'brewers'),                               -- Famous Racing Sausage, 2018
    ('italian-racing-sausage-2010', 'brewers'),                              -- Italian Racing Sausage, 2010
    ('italian-racing-sausage-2011', 'brewers'),                              -- Italian Racing Sausage, 2011
    ('italian-racing-sausage-2012', 'brewers'),                              -- Italian Racing Sausage, 2012
    ('italian-sausage-2003', 'brewers'),                                     -- Italian Sausage, 2003
    ('klement-hot-dog-mascot-2006', 'brewers'),                              -- Klement (Hot Dog Mascot), 2006
    ('polish-racing-sausage-2008', 'brewers'),                               -- Polish Racing Sausage, 2008
    ('polish-racing-sausage-2013', 'brewers'),                               -- Polish Racing Sausage, 2013
    ('polish-sausage-2003', 'brewers'),                                      -- Polish Sausage, 2003
    ('fredbird-big-bird-2022', 'cardinals'),                                 -- Fredbird & Big Bird, 2022
    ('fredbird-bobble-belly-2008', 'cardinals'),                             -- Fredbird (Bobble Belly), 2008
    ('fredbird-bobble-frame-2009', 'cardinals'),                             -- Fredbird (Bobble Frame), 2009
    ('fredbird-kids-2017', 'cardinals'),                                     -- Fredbird (Kids), 2017
    ('fredbird-leg-lamp-2023', 'cardinals'),                                 -- Fredbird (Leg Lamp), 2023
    ('fredbird-louie-dual-2018', 'cardinals'),                               -- Fredbird & Louie (Dual), 2018
    ('santa-fredbird-2018', 'cardinals'),                                    -- Santa Fredbird, 2018
    ('clark-the-cub-2019', 'cubs'),                                          -- Clark (the Cub), 2019
    ('clark-the-cub-2025', 'cubs'),                                          -- Clark the Cub, 2025
    ('clark-w-flag-2015', 'cubs'),                                           -- Clark ("W" Flag), 2015
    ('community-cubs-clark-hogan-28f56468', 'cubs'),                         -- Clark Hogan [community]
    ('d-baxter-2008', 'diamondbacks'),                                       -- D. Baxter (Mascot), 2008
    ('maxter-mascot-2003', 'diamondbacks'),                                  -- Maxter (Mascot), 2003
    ('community-giants-lou-seal-b37d064c', 'giants'),                        -- Lou Seal (Indiana Lou VIP) [community]
    ('lou-seal-2022', 'giants'),                                             -- Lou Seal, 2022
    ('lou-seal-chinese-heritage-2009', 'giants'),                            -- Lou Seal (Chinese Heritage), 2009
    ('lou-seal-cinco-de-mayo-2016', 'giants'),                               -- Lou Seal (Cinco de Mayo), 2016
    ('lou-seal-greek-heritage-2023', 'giants'),                              -- Lou Seal (Greek Heritage), 2023
    ('lou-seal-italian-2017', 'giants'),                                     -- Lou Seal (Italian), 2017
    ('lou-seal-luchador-2010', 'giants'),                                    -- Lou Seal ("Luchador"), 2010
    ('lou-seal-oktoberfest-2007', 'giants'),                                 -- Lou Seal (Oktoberfest), 2007
    ('lou-seal-oktoberfest-2018', 'giants'),                                 -- Lou Seal (Oktoberfest), 2018
    ('lou-seal-policeman-jul-2009', 'giants'),                               -- Lou Seal (Policeman), 2009
    ('lou-seal-policeman-sep-2009', 'giants'),                               -- Lou Seal (Policeman), 2009
    ('lou-seal-sj-sharkie-zamboni-2019', 'giants'),                          -- Lou Seal & SJ Sharkie Zamboni, 2019
    ('lou-seal-splash-hits-counter-2023', 'giants'),                         -- Lou Seal (Splash Hits Counter), 2023
    ('lou-seal-stitch-pitch-2009', 'giants'),                                -- Lou Seal (Stitch & Pitch), 2009
    ('lou-seal-themed-runner-2019', 'giants'),                               -- Lou Seal (Themed Runner), 2019
    ('slider-bobble-belly-mascot-2003', 'guardians'),                        -- Slider (- Bobble Belly Mascot), 2003
    ('slider-gapper-double-mascots-2007', 'guardians'),                      -- Slider/Gapper Double (Mascots), 2007
    ('slider-lifeguard-mascot-2009', 'guardians'),                           -- Slider (Lifeguard) (Mascot), 2009
    ('slider-mascot-2002', 'guardians'),                                     -- Slider (- Mascot), 2002
    ('mariner-moose-2006', 'mariners'),                                      -- Mariner Moose, 2006
    ('billy-the-marlin-2006', 'marlins'),                                    -- Billy the Marlin, 2006
    ('billy-the-marlin-2019', 'marlins'),                                    -- Billy the Marlin, 2019
    ('billy-the-marlin-aviation-2017', 'marlins'),                           -- Billy the Marlin (Aviation), 2017
    ('billy-the-marlin-birthday-2017', 'marlins'),                           -- Billy the Marlin (Birthday), 2017
    ('billy-the-marlin-stormtrooper-2015', 'marlins'),                       -- Billy the Marlin (Stormtrooper), 2015
    ('community-marlins-billy-the-marlin-birthday--02224000', 'marlins'),    -- Billy the Marlin (Birthday) [community]
    ('mr-met-2024', 'mets'),                                                 -- Mr. Met, 2024
    ('mr-met-7-line-army-100th-2019', 'mets'),                               -- Mr. Met (7 Line Army 100th), 2019
    ('mr-met-empire-state-building-2025', 'mets'),                           -- Mr. Met (Empire State Building), 2025
    ('mr-met-han-solo-star-wars-2018', 'mets'),                              -- Mr. Met (Han Solo, Star Wars), 2018
    ('mr-met-indiana-jones-2023', 'mets'),                                   -- Mr. Met (Indiana Jones), 2023
    ('mr-met-knitting-2013', 'mets'),                                        -- Mr. Met (Knitting), 2013
    ('mr-met-mascot-2004', 'mets'),                                          -- Mr. Met (Mascot), 2004
    ('mr-met-mascot-2011', 'mets'),                                          -- Mr. Met (Mascot), 2011
    ('mr-met-master-met-star-wars-2013', 'mets'),                            -- Mr. Met ("Master Met" Star Wars), 2013
    ('mr-met-on-the-moon-2019', 'mets'),                                     -- Mr. Met on the Moon, 2019
    ('mr-met-unisphere-light-up-2026', 'mets'),                              -- Mr. Met (Unisphere Light-Up), 2026
    ('sparky-mr-met-2022', 'mets'),                                          -- Sparky & Mr. Met, 2022
    ('george-mason-screech-2021', 'nationals'),                              -- George Mason Screech, 2021
    ('screech-kids-club-2012', 'nationals'),                                 -- Screech (Kids Club), 2012
    ('screech-mascot-2006', 'nationals'),                                    -- Screech (Mascot), 2006
    ('screech-night-out-2023', 'nationals'),                                 -- Screech ("Night OUT"), 2023
    ('screech-teddy-2025', 'nationals'),                                     -- Screech & Teddy, 2025
    ('funbird-mascot-2002', 'orioles'),                                      -- "Funbird" (Mascot), 2002
    ('oriole-bird-2015', 'orioles'),                                         -- Oriole Bird, 2015
    ('oriole-bird-2023', 'orioles'),                                         -- Oriole Bird, 2023
    ('oriole-bird-hall-of-fame-2021', 'orioles'),                            -- Oriole Bird (Hall of Fame), 2021
    ('oriole-bird-hall-of-fame-spring-training-2022', 'orioles'),            -- Oriole Bird (Hall of Fame, Spring Training), 2022
    ('oriole-bird-stranger-things-2019', 'orioles'),                         -- Oriole Bird (Stranger Things), 2019
    ('oriole-bird-toothbrush-holder-2017', 'orioles'),                       -- Oriole Bird (Toothbrush Holder), 2017
    ('community-padres-swingin-friar-2f30c061', 'padres'),                   -- Swingin’ Friar (Nascar Friar) [community]
    ('community-padres-swingin-friar-879957e5', 'padres'),                   -- Swingin’ Friar (01 Friar) [community]
    ('community-padres-swingin-friar-966f0725', 'padres'),                   -- Swingin’ Friar (Superhero Friar) [community]
    ('community-padres-swingin-friar-e098c15c', 'padres'),                   -- Swingin’ Friar (Half Marathon Friar) [community]
    ('swingin-friar-50th-anniversary-2019', 'padres'),                       -- Swingin' Friar (50th Anniversary), 2019
    ('phanatic-band-themed-2016', 'phillies'),                               -- Phanatic (Band Themed), 2016
    ('phanatic-iron-throne-2018', 'phillies'),                               -- Phanatic (Iron Throne), 2018
    ('phanatic-master-phanatic-star-wars-2016', 'phillies'),                 -- Phanatic ("Master Phanatic", Star Wars), 2016
    ('phanatic-star-wars-2017', 'phillies'),                                 -- Phanatic (Star Wars), 2017
    ('phil-phillis-original-mascots-2003', 'phillies'),                      -- Phil & Phillis (Original Mascots), 2003
    ('phillie-phanatic-2007', 'phillies'),                                   -- Phillie Phanatic, 2007
    ('phillie-phanatic-colonial-2026', 'phillies'),                          -- Phillie Phanatic (Colonial), 2026
    ('phillie-phanatic-mascot-2002', 'phillies'),                            -- Phillie Phanatic (Mascot), 2002
    ('phillie-phanatic-variant-2016', 'phillies'),                           -- Phillie Phanatic (Variant), 2016
    ('phoebe-phanatic-stitch-n-pitch-2016', 'phillies'),                     -- Phoebe Phanatic (Stitch 'n Pitch), 2016
    ('cheese-chester-mascot-2005', 'pirates'),                               -- "Cheese Chester" (Mascot), 2005
    ('jolly-roger-mascot-2006', 'pirates'),                                  -- Jolly Roger (Mascot), 2006
    ('pirate-parrot-mascot-2002', 'pirates'),                                -- Pirate Parrot (Mascot), 2002
    ('pirate-parrot-mascot-2011', 'pirates'),                                -- Pirate Parrot (Mascot), 2011
    ('potato-pete-mascot-2006', 'pirates'),                                  -- "Potato Pete" (Mascot), 2006
    ('raise-the-jolly-roger-2016', 'pirates'),                               -- "Raise the Jolly Roger", 2016
    ('community-rangers-rangers-captain-b34b17a1', 'rangers'),               -- Rangers Captain (Block Captain Bobblehead) [community]
    ('rangers-captain-20th-anniversary-2023', 'rangers'),                    -- Rangers Captain (20th Anniversary), 2023
    ('rangers-captain-kubota-2026', 'rangers'),                              -- Rangers Captain (Kubota), 2026
    ('rangers-captain-mascot-2004', 'rangers'),                              -- Rangers Captain (Mascot), 2004
    ('rangers-captain-mascot-2018', 'rangers'),                              -- Rangers Captain (Mascot), 2018
    ('astro-devil-rays-mascot-2013', 'rays'),                                -- Astro (Devil Rays Mascot), 2013
    ('dj-kitty-2012', 'rays'),                                               -- DJ Kitty, 2012
    ('raymond-bobble-belly-2013', 'rays'),                                   -- Raymond ("Bobble Belly"), 2013
    ('raymond-dj-kitty-double-2016', 'rays'),                                -- Raymond & DJ Kitty (Double), 2016
    ('raymond-mascot-2001', 'rays'),                                         -- Raymond (Mascot), 2001
    ('wally-2015', 'red-sox'),                                               -- Wally, 2015
    ('wally-tessie-2016', 'red-sox'),                                        -- Wally & Tessie, 2016
    ('gapper-mascot-2003', 'reds'),                                          -- Gapper (Mascot), 2003
    ('mr-redlegs-2019', 'reds'),                                             -- Mr. Redlegs, 2019
    ('mr-redlegs-2022', 'reds'),                                             -- Mr. Redlegs, 2022
    ('mr-redlegs-f-35-2018', 'reds'),                                        -- Mr. Redlegs (F-35), 2018
    ('mr-redlegs-x-wing-fighter-2016', 'reds'),                              -- Mr. Redlegs (X-Wing Fighter), 2016
    ('rosie-red-2018', 'reds'),                                              -- Rosie Red, 2018
    ('dinger-bunny-gnome-2014', 'rockies'),                                  -- The Dinger Bunny Bobblehead Gnome, 2014
    ('dinger-mascot-2002', 'rockies'),                                       -- Dinger (Mascot), 2002
    ('dinger-mascot-2003', 'rockies'),                                       -- Dinger (Mascot), 2003
    ('dinger-mascot-2026', 'rockies'),                                       -- Dinger (Mascot) Bobblehead, 2026
    ('sluggerrr-2018', 'royals'),                                            -- Sluggerrr, 2018
    ('sluggerrr-asian-american-pacific-islander-heritage-2025', 'royals'),   -- Sluggerrr (Asian American & Pacific Islander Heritage), 2025
    ('sluggerrr-irish-heritage-2025', 'royals'),                             -- Sluggerrr (Irish Heritage), 2025
    ('sluggerrr-italian-heritage-2025', 'royals'),                           -- Sluggerrr (Italian Heritage), 2025
    ('sluggerrr-jewish-heritage-2025', 'royals'),                            -- Sluggerrr (Jewish Heritage), 2025
    ('sluggerrr-mascot-2002', 'royals'),                                     -- Sluggerrr (Mascot), 2002
    ('sluggerrr-viva-los-royals-2025', 'royals'),                            -- Sluggerrr (Viva Los Royals), 2025
    ('msu-paws-2023', 'tigers'),                                             -- MSU PAWS, 2023
    ('paws-mascot-2009', 'tigers'),                                          -- Paws (Mascot), 2009
    ('university-of-michigan-paws-2023', 'tigers'),                          -- University of Michigan PAWS, 2023
    ('wmu-paws-2023', 'tigers'),                                             -- WMU PAWS, 2023
    ('tc-mascot-2017', 'twins'),                                             -- T.C. (Mascot), 2017
    ('tc-mascot-2019', 'twins'),                                             -- T.C. (Mascot), 2019
    ('southpaw-birthday-2017', 'white-sox'),                                 -- Southpaw (Birthday), 2017
    ('southpaw-game-of-thrones-2017', 'white-sox'),                          -- Southpaw (Game of Thrones), 2017
    ('southpaw-star-wars-2016', 'white-sox'),                                -- Southpaw (Star Wars), 2016
    ('southpaw-tommy-hawk-2019', 'white-sox')                                -- Southpaw & Tommy Hawk, 2019
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('celebrity', 'Celebrity')
on conflict (slug) do nothing;

-- Celebrity -- 35 listings.
-- Non-baseball public figures: musicians, actors and athletes from other sports. Broadcasters are excluded by choice, as is Snoopy (a licensed character, not a person). Elvis Andrus is a shortstop and is not here.
-- Unlike every tag above, this one is discovery-based rather than mechanical -- there is no keyword for "celebrity", so it is a best effort and probably not exhaustive.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'celebrity'
from (
  values
    ('andre-johnson-hof-2024', 'astros'),               -- Andre Johnson (HOF), 2024
    ('g-eazy-with-sound-2017', 'athletics'),            -- G-Eazy (with sound), 2017
    ('ludacris-2024', 'braves'),                        -- Ludacris, 2024
    ('giannis-antetokounmpo-2022', 'brewers'),          -- Giannis Antetokounmpo, 2022
    ('billy-joel-2017', 'cardinals'),                   -- Billy Joel, 2017
    ('elvis-2018', 'cardinals'),                        -- Elvis, 2018
    ('jayson-tatum-2023', 'cardinals'),                 -- Jayson Tatum, 2023
    ('john-daly-2021', 'cardinals'),                    -- John Daly, 2021
    ('john-goodman-night-2016', 'cardinals'),           -- John Goodman Night, 2016
    ('kenny-wallace-2024', 'cardinals'),                -- Kenny Wallace, 2024
    ('kurt-warner-2018', 'cardinals'),                  -- Kurt Warner, 2018
    ('bill-murray-2025', 'cubs'),                       -- Bill Murray, 2025
    ('lebron-james-2023', 'dodgers'),                   -- LeBron James, 2023
    ('luka-doncic-2026', 'dodgers'),                    -- Luka Dončić, 2026
    ('shaquille-oneal-2026', 'dodgers'),                -- Shaquille O'Neal, 2026
    ('bruce-lee-75th-birthday-2015', 'giants'),         -- Bruce Lee (75th Birthday), 2015
    ('bruce-lee-year-of-the-dragon-2012', 'giants'),    -- Bruce Lee ("Year of the Dragon"), 2012
    ('community-giants-e-40-vip-7bd91db4', 'giants'),   -- E-40 VIP (Talking) [community]
    ('e-40-2022', 'giants'),                            -- E-40, 2022
    ('elvis-2013', 'giants'),                           -- Elvis, 2013
    ('joe-montana-2017', 'giants'),                     -- Joe Montana, 2017
    ('joe-montana-vip-2017', 'giants'),                 -- Joe Montana (VIP), 2017
    ('drew-carey-2006', 'guardians'),                   -- Drew Carey, 2006
    ('pitbull-2018', 'marlins'),                        -- Pitbull, 2018
    ('alex-ovechkin-2026', 'nationals'),                -- Alex Ovechkin, 2026
    ('billy-joel-2017', 'phillies'),                    -- Billy Joel, 2017
    ('arnold-palmer-2009', 'pirates'),                  -- Arnold Palmer, 2009
    ('bad-bunny-2023', 'red-sox'),                      -- Bad Bunny, 2023
    ('billy-joel-2017', 'red-sox'),                     -- Billy Joel, 2017
    ('bob-ross-2018', 'reds'),                          -- Bob Ross, 2018
    ('elvis-2017', 'reds'),                             -- Elvis, 2017
    ('elvis-2018', 'reds'),                             -- Elvis, 2018
    ('billy-joel-2018', 'royals'),                      -- Billy Joel, 2018
    ('patrick-mahomes-2024', 'royals'),                 -- Patrick Mahomes, 2024
    ('billy-joel-2025', 'yankees')                      -- Billy Joel, 2025
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What landed: Día de los Muertos 27, Game of Thrones 25, Hall of Fame 53, All-Star 36, Record Holder/Breaker 37, Legends 15, Audio 20, World Baseball Classic 4, Disney 10, Marvel 47, Peanuts 54, Mascot 164, Celebrity 35.
select slug, label, listing_count from public.tag_counts order by listing_count desc, label;

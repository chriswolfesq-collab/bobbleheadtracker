-- Finishes supabase/seed_award_and_count_tags.sql.
--
-- That file is 45 KiB and its paste into the SQL editor was cut at about
-- 32 KiB, mid-way through the Duos values list -- so Duos inserted its first
-- 50 rows and the truncated remainder was a syntax error that stopped
-- Triples and Quads from running at all. Nothing was wrong with the SQL; it
-- just didn't all arrive.
--
-- This re-runs those three inserts alone, verbatim, at a size that pastes in
-- one piece. Idempotent -- the 50 Duos rows already in place are skipped
-- rather than duplicated, so it does not matter that they are included again.

insert into public.tags (slug, label)
values ('duos', 'Duos')
on conflict (slug) do nothing;

-- Duos -- 112 listings.
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

-- Expect Duos 112, Triples 20, Quads 5.
select slug, label, listing_count from public.tag_counts
where slug in ('duos', 'triples', 'quads');

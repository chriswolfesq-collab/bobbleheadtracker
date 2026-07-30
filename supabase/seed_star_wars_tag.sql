-- Applies the "Star Wars" tag across the whole catalog in one pass -- the 138
-- bobbleheads that are Star Wars whoever gave them away. A Grogu is a Star Wars
-- bobblehead whether the Nationals or the Athletics handed it out, and nothing
-- in a team-and-year catalog says so; that's the gap supabase/tags.sql exists
-- to close, and this is the first tag applied at catalog scale rather than one
-- listing at a time.
--
-- 125 curated listings from data/giveaways plus 13 community submissions.
-- Seven were already tagged by hand and are included anyway -- the insert
-- ignores them rather than duplicating them.
--
-- Idempotent: re-running adds nothing and overwrites nothing. Paste into the
-- Supabase SQL editor. Requires supabase/tags.sql to have been run first.

-- The label, minted if the vocabulary doesn't have it yet. Left alone if it
-- does, so the casing already in use survives this script.
insert into public.tags (slug, label)
values ('star-wars', 'Star Wars')
on conflict (slug) do nothing;

-- created_by stays null: this is a catalog-wide sweep, not any one account's
-- edit, and the column is there to attribute the latter.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'star-wars'
from (
  values
    -- angels
    ('mike-trout-bb-8-star-wars-2023', 'angels'),                                       -- Mike Trout & BB-8 (Star Wars), 2023
    ('shohei-ohtani-ohtani-wan-kenobi-star-wars-2022', 'angels'),                       -- Shohei Ohtani ("Ohtani-Wan Kenobi", Star Wars), 2022

    -- astros
    ('carlos-correa-mandalorian-grogu-2026', 'astros'),                                 -- Carlos Correa Mandalorian & Grogu, 2026
    ('mauricio-dubon-starwars-2025', 'astros'),                                         -- Mauricio Dubon (Starwars), 2025
    ('star-wars-tucker-special-ticket-2024', 'astros'),                                 -- Star Wars Tucker (Special Ticket), 2024
    ('star-wars-triple-special-ticket-2023', 'astros'),                                 -- Star Wars triple (Special Ticket), 2023
    ('yuli-wan-2022', 'astros'),                                                        -- Yuli Gurriel (Wan), 2022
    ('max-stassi-star-wars-2019', 'astros'),                                            -- Max Stassi (Star Wars), 2019
    ('carlos-beltran-jedi-2017', 'astros'),                                             -- Carlos Beltran (Jedi), 2017
    ('orbit-wan-kenobi-bobblehead-2015', 'astros'),                                     -- Orbit (Wan Kenobi Bobblehead), 2015

    -- athletics
    ('mark-kotsay-mandalorian-star-wars-2023', 'athletics'),                            -- Mark Kotsay Mandalorian (Star Wars), 2023
    ('matt-olson-chewbacca-2018', 'athletics'),                                         -- Matt Olson & Chewbacca, 2018

    -- braves
    ('mandalorian-braves-2023', 'braves'),                                              -- Mandalorian Braves, 2023
    ('ozzie-calrissian-star-wars-2018', 'braves'),                                      -- "Ozzie Calrissian" (Star Wars), 2018
    ('ra-dickey-stormtrooper-2017', 'braves'),                                          -- R.A. Dickey (Stormtrooper), 2017
    ('jedi-master-schuerholz-2016', 'braves'),                                          -- "Jedi Master Schuerholz", 2016
    ('jason-grilli-x-wing-fighter-2015', 'braves'),                                     -- Jason Grilli (X-Wing Fighter), 2015

    -- brewers
    ('sal-frelick-star-wars-2024', 'brewers'),                                          -- Sal Frelick (Star Wars), 2024
    ('ueck-skywalker-bob-uecker-2023', 'brewers'),                                      -- "Ueck Skywalker" (Bob Uecker), 2023
    ('lorenzo-cain-jedi-2021', 'brewers'),                                              -- Lorenzo Cain (Jedi), 2021
    ('orlando-calrissian-orlando-arcia-2019', 'brewers'),                               -- "Orlando Calrissian" (Orlando Arcia), 2019
    ('braun-solo-ryan-braun-2018', 'brewers'),                                          -- "Braun Solo" (Ryan Braun), 2018
    ('jedi-keon-keon-broxton-2017', 'brewers'),                                         -- "Jedi Keon" (Keon Broxton), 2017
    ('stormin-gorman-gorman-thomas-stormtrooper-2016', 'brewers'),                      -- "Stormin' Gorman" (Gorman Thomas, Stormtrooper), 2016
    ('jonathan-lucroy-jedi-luc-2015', 'brewers'),                                       -- Jonathan Lucroy ("Jedi Luc"), 2015

    -- cubs
    ('nico-hoerner-jedi-2023', 'cubs'),                                                 -- Nico Hoerner (Jedi), 2023
    ('star-wars-mandalorian-2022', 'cubs'),                                             -- Star Wars Mandalorian, 2022
    ('jedi-rizzo-2014', 'cubs'),                                                        -- "Jedi Rizzo", 2014

    -- diamondbacks
    ('gabriel-moreno-mandalorian-2026', 'diamondbacks'),                                -- Gabriel Moreno (Mandalorian), 2026
    ('corbin-carroll-2025', 'diamondbacks'),                                            -- Corbin Carroll (Rebel Pilot), 2025
    ('lourdes-gurriel-jr-2024', 'diamondbacks'),                                        -- Lourdes Gurriel Jr. (Stormtrooper), 2024
    ('paul-solo-star-wars-2018', 'diamondbacks'),                                       -- "Paul Solo" (Star Wars), 2018
    ('paul-goldschmidt-star-wars-2017', 'diamondbacks'),                                -- Paul Goldschmidt (Star Wars), 2017
    ('aj-pollock-star-wars-2015', 'diamondbacks'),                                      -- A.J. Pollock (Star Wars), 2015
    ('josh-collmenter-star-wars-day-2014', 'diamondbacks'),                             -- Josh Collmenter (Star Wars Day), 2014

    -- dodgers
    ('star-wars-orel-wan-kenobi-special-promotion-2021', 'dodgers'),                    -- Star Wars: Orel-Wan Kenobi Special Promotion, 2021
    ('hyun-solo-special-promotion-2019', 'dodgers'),                                    -- Hyun Solo Special Promotion, 2019
    ('kenley-calrissian-star-wars-2018', 'dodgers'),                                    -- Kenley Calrissian Star Wars, 2018

    -- giants
    ('ewok-2023', 'giants'),                                                            -- Ewok, 2023
    ('brandon-crawford-star-wars-2019', 'giants'),                                      -- Brandon Crawford (Star Wars), 2019
    ('millennium-falcon-2018', 'giants'),                                               -- Millennium Falcon, 2018
    ('madison-bumgarner-stormtrooper-2016', 'giants'),                                  -- Madison Bumgarner (Stormtrooper), 2016
    ('buster-posey-stormtrooper-2013', 'giants'),                                       -- Buster Posey (Stormtrooper), 2013
    ('buster-posey-stormtrooper-vip-2013', 'giants'),                                   -- Buster Posey (Stormtrooper VIP), 2013

    -- mariners
    ('chewbacca-2018', 'mariners'),                                                     -- Chewbacca, 2018
    ('han-seago-star-wars-2018', 'mariners'),                                           -- "Han Seago" (Star Wars), 2018

    -- marlins
    ('adam-conley-stormtrooper-2017', 'marlins'),                                       -- Adam Conley (Stormtrooper), 2017
    ('billy-the-marlin-stormtrooper-2015', 'marlins'),                                  -- Billy the Marlin (Stormtrooper), 2015
    ('jedi-billy-2014', 'marlins'),                                                     -- Jedi Billy, 2014

    -- mets
    ('trevor-may-mandalorian-2022', 'mets'),                                            -- Trevor May (Mandalorian), 2022
    ('obi-wan-canobi-2019', 'mets'),                                                    -- "Obi-Wan Canobi", 2019
    ('mr-met-han-solo-star-wars-2018', 'mets'),                                         -- Mr. Met (Han Solo, Star Wars), 2018
    ('travis-darnaud-jedi-knight-2014', 'mets'),                                        -- Travis d'Arnaud (Jedi Knight), 2014
    ('mr-met-master-met-star-wars-2013', 'mets'),                                       -- Mr. Met ("Master Met" Star Wars), 2013

    -- nationals
    ('grogu-2026', 'nationals'),                                                        -- Grogu, 2026
    ('juan-solo-star-wars-2022', 'nationals'),                                          -- Juan "Solo" (Star Wars), 2022
    ('obi-sean-kenobi-2019', 'nationals'),                                              -- "Obi 'Sean' Kenobi" (Sean Doolittle), 2019

    -- orioles
    ('star-wars-weekend-bobblehead-jedi-themed-2026', 'orioles'),                       -- Star Wars Weekend Bobblehead (Jedi-Themed), 2026
    ('trey-mancini-bb-8-star-wars-2019', 'orioles'),                                    -- Trey Mancini & BB-8 (Star Wars), 2019
    ('oday-wan-kenobi-darren-oday-star-wars-2018', 'orioles'),                          -- "O'Day-Wan Kenobi" (Darren O'Day, Star Wars), 2018

    -- padres
    ('manny-mandalorian-2022', 'padres'),                                               -- Manny "Mandalorian", 2022
    ('jedi-andy-andy-green-2016', 'padres'),                                            -- "Jedi Andy" (Andy Green), 2016

    -- phillies
    ('ranger-suarez-mandalorian-2024', 'phillies'),                                     -- Ranger Suarez (Mandalorian), 2024
    ('schwarbie-wan-kenobi-2023', 'phillies'),                                          -- "Schwarbie Wan Kenobi", 2023
    ('jake-arrieta-jedi-bobble-figurine-2019', 'phillies'),                             -- Jake Arrieta (Jedi, Bobble Figurine), 2019
    ('han-nola-aaron-nola-star-wars-2018', 'phillies'),                                 -- "Han Nola" (Aaron Nola, Star Wars), 2018
    ('phanatic-star-wars-2017', 'phillies'),                                            -- Phanatic (Star Wars), 2017
    ('phanatic-master-phanatic-star-wars-2016', 'phillies'),                            -- Phanatic ("Master Phanatic", Star Wars), 2016

    -- pirates
    ('jameson-taillon-star-wars-2019', 'pirates'),                                      -- Jameson Taillon (Star Wars), 2019

    -- rangers
    ('grogu-star-wars-2026', 'rangers'),                                                -- Grogu (Star Wars), 2026
    ('kumar-rocker-star-wars-mandokumar-2025', 'rangers'),                              -- Kumar Rocker (Star Wars MandoKumar), 2025
    ('josh-jung-star-wars-jung-jedi-2024', 'rangers'),                                  -- Josh Jung (Star Wars Jung Jedi), 2024
    ('nathaniel-lowe-star-wars-stormtrooper-2023', 'rangers'),                          -- Nathaniel Lowe (Star Wars Stormtrooper), 2023
    ('adolis-garcia-star-wars-mandalorian-2022', 'rangers'),                            -- Adolis Garcia (Star Wars Mandalorian), 2022
    ('nick-solak-star-wars-han-solak-2021', 'rangers'),                                 -- Nick Solak (Star Wars Han Solak), 2021
    ('rougned-odor-star-wars-first-odor-stormtrooper-2019', 'rangers'),                 -- Rougned Odor (Star Wars First Odor Stormtrooper), 2019
    ('joey-gallo-star-wars-han-gallo-2018', 'rangers'),                                 -- Joey Gallo (Star Wars Han Gallo), 2018
    ('jonathan-lucroy-star-wars-master-lucroy-2017', 'rangers'),                        -- Jonathan Lucroy (Star Wars Master Lucroy), 2017
    ('elvis-andrus-star-wars-landrus-calrissian-2016', 'rangers'),                      -- Elvis Andrus (Star Wars Landrus Calrissian), 2016

    -- rays
    ('kevin-kiermaier-star-wars-2017', 'rays'),                                         -- Kevin Kiermaier (Star Wars), 2017
    ('chris-archer-stormtrooper-2016', 'rays'),                                         -- Chris Archer (Stormtrooper), 2016
    ('han-longo-evan-longoria-star-wars-2015', 'rays'),                                 -- "Han Longo" (Evan Longoria, Star Wars), 2015
    ('wil-myers-star-wars-2014', 'rays'),                                               -- Wil Myers (Star Wars), 2014
    ('ben-zobrist-jedi-zo-star-wars-2013', 'rays'),                                     -- Ben Zobrist ("Jedi ZO", Star Wars), 2013

    -- red-sox
    ('alex-verdugo-jedi-devers-also-this-month-star-wars-2022', 'red-sox'),             -- Alex Verdugo ("Jedi Devers" also this month, Star Wars), 2022
    ('millennium-falcon-over-fenway-star-wars-2019', 'red-sox'),                        -- Millennium Falcon over Fenway (Star Wars), 2019
    ('xando-calrissian-xander-bogaerts-star-wars-2018', 'red-sox'),                     -- "Xando Calrissian" (Xander Bogaerts, Star Wars), 2018
    ('mookie-betts-jedi-star-wars-2017', 'red-sox'),                                    -- Mookie Betts (Jedi, Star Wars), 2017

    -- reds
    ('clone-trooper-2025', 'reds'),                                                     -- Clone Trooper, 2025
    ('mandalorian-2023', 'reds'),                                                       -- Mandalorian, 2023
    ('joey-votto-jedi-joey-star-wars-2022', 'reds'),                                    -- Joey Votto (Jedi Joey, Star Wars), 2022
    ('darth-vader-2019', 'reds'),                                                       -- Darth Vader, 2019
    ('chewbacca-2018', 'reds'),                                                         -- Chewbacca, 2018
    ('stormtrooper-2017', 'reds'),                                                      -- Stormtrooper, 2017
    ('yoda-2016', 'reds'),                                                              -- Yoda, 2016
    ('mr-redlegs-x-wing-fighter-2016', 'reds'),                                         -- Mr. Redlegs (X-Wing Fighter), 2016
    ('r2-d2-2015', 'reds'),                                                             -- R2-D2, 2015

    -- rockies
    ('kris-bryant-jedi-2023', 'rockies'),                                               -- Kris Bryant (Jedi), 2023
    ('adam-ottavino-star-wars-2017', 'rockies'),                                        -- Adam Ottavino (Star Wars), 2017
    ('charlie-blackmon-star-wars-2016', 'rockies'),                                     -- Charlie Blackmon (Star Wars), 2016
    ('cargo-fett-carlos-gonzalez-star-wars-2015', 'rockies'),                           -- "Cargo Fett" Carlos Gonzalez (Star Wars), 2015
    ('obi-wan-owitzki-gnome-2014', 'rockies'),                                          -- Obi-Wan Owitzki Bobblehead Gnome, 2014

    -- royals
    ('sal-solo-2018', 'royals'),                                                        -- "Sal Solo" (Salvador Perez, Star Wars), 2018
    ('cam-butera-tie-fighter-pilot-2017', 'royals'),                                    -- Cam Butera (TIE Fighter Pilot), 2017
    ('eric-hosmer-star-wars-x-wing-2016', 'royals'),                                    -- Eric Hosmer (Star Wars X-Wing), 2016
    ('alex-gordon-jedi-2015', 'royals'),                                                -- Alex Gordon (Jedi), 2015

    -- tigers
    ('jedi-miggy-2017', 'tigers'),                                                      -- "Jedi Miggy" (Miguel Cabrera), 2017

    -- twins
    ('grogu-star-wars-theme-ticket-2026', 'twins'),                                     -- Grogu (Star Wars, Theme Ticket), 2026
    ('mandalorian-2022', 'twins'),                                                      -- Mandalorian, 2022
    ('obi-wan-kepleroni-2019', 'twins'),                                                -- "Obi-Wan Kepleroni" (Max Kepler), 2019
    ('joe-solo-mauer-star-wars-2018', 'twins'),                                         -- Joe "Solo" Mauer (Star Wars), 2018
    ('brian-dozier-stormtrooper-2017', 'twins'),                                        -- Brian Dozier (Stormtrooper), 2017
    ('trevor-plouffe-skywalker-star-wars-2016', 'twins'),                               -- Trevor Plouffe ("Skywalker", Star Wars), 2016
    ('phil-hughes-star-wars-2015', 'twins'),                                            -- Phil Hughes (Star Wars), 2015

    -- white-sox
    ('r2-d2-2019', 'white-sox'),                                                        -- R2-D2, 2019
    ('chewbacca-2019', 'white-sox'),                                                    -- Chewbacca, 2019
    ('hawk-solo-star-wars-2018', 'white-sox'),                                          -- Hawk "Solo" (Star Wars), 2018
    ('stormtrooper-2017', 'white-sox'),                                                 -- Stormtrooper, 2017
    ('southpaw-star-wars-2016', 'white-sox'),                                           -- Southpaw (Star Wars), 2016
    ('adam-wan-kenobi-2015', 'white-sox'),                                              -- "Adam Wan Kenobi" (Star Wars), 2015

    -- yankees
    ('max-fried-mandalorian-with-grogu-2026', 'yankees'),                               -- Max Fried (Mandalorian, with Grogu), 2026
    ('anthony-rizzo-mandalorian-2023', 'yankees'),                                      -- Anthony Rizzo (Mandalorian), 2023
    ('yoda-star-wars-2022', 'yankees'),                                                 -- Yoda (Star Wars), 2022
    ('cc-sabathia-jedi-2019', 'yankees'),                                               -- CC Sabathia (Jedi), 2019
    ('aaron-judge-jedi-star-wars-2018', 'yankees'),                                     -- Aaron Judge (Jedi, Star Wars), 2018

    -- Community submissions. These ids are database rows, not entries in
    -- data/giveaways, so they can't be regenerated from the repo.
    ('community-astros-carlos-correa-the-mandalorian-and-grogu--c3c93306', 'astros'),   -- Carlos Correa “ The Mandalorian and Grogu”
    ('community-athletics-grogu-18fd0a21', 'athletics'),                                -- Grogu
    ('community-cubs-grogu-effff6fe', 'cubs'),                                          -- Grogu
    ('community-giants-brandon-crawford-3b93ef9f', 'giants'),                           -- Brandon Crawford (Starwars VIP)
    ('community-giants-star-wars-grogu-eb8a4c6a', 'giants'),                            -- Star Wars Grogu
    ('community-marlins-michael-morse-star-wars-canceled--6310488c', 'marlins'),        -- Michael Morse (Star Wars, canceled)
    ('community-padres-fernando-tatis-jr--55b34312', 'padres'),                         -- Fernando Tatis, Jr. (Nando Calrissian)
    ('community-padres-jackson-merrill-8e8cf5ef', 'padres'),                            -- Jackson Merrill (Merrill & Grogu)
    ('community-padres-xander-bogaerts-91f18ef6', 'padres'),                            -- Xander Bogaerts (X-wing)
    ('community-royals-grogu-3edf7f6d', 'royals'),                                      -- Grogu
    ('community-royals-jedi-bobby-witt-jr--bddb614a', 'royals'),                        -- Bobby Witt Jr. (Jedi)
    ('community-white-sox-lucas-giolito-x-wing-pilot-2a851e56', 'white-sox'),           -- Lucas Giolito X-Wing Pilot
    ('community-white-sox-steve-stone-d7298cc3', 'white-sox')                           -- Steve Stone (Stormtrooper)
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, tag_slug) do nothing;

-- What landed. Expect 138 the first time and 138 every time after.
select listing_count from public.tag_counts where slug = 'star-wars';

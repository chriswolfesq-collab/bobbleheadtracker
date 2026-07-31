-- Seven more tags: five feats, the World Series, and the broadcast booth.
--
-- Deliberately kept small enough to paste in one piece -- see
-- supabase/finish_award_and_count_tags.sql for what happens otherwise.
--
-- Idempotent. Needs the widened key from supabase/fix_bobblehead_tags_pk.sql.
--
-- These overlap Record Holder/Breaker on purpose: a no-hitter is both a feat
-- and a milestone, and a listing carrying both tags is found by either.

insert into public.tags (slug, label)
values ('cycle', 'Cycle')
on conflict (slug) do nothing;

-- Cycle -- 8 listings.
-- Hitting for the cycle, Aaron Hill's "#BiCycle" (two in a week) included.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'cycle'
from (
  values
    ('shohei-ohtani-cycle-2021', 'angels'),              -- Shohei Ohtani (Cycle), 2021
    ('altuve-cycle-2024', 'astros'),                     -- Jose Altuve (Cycle), 2024
    ('yordan-alvarez-cycle-2025', 'astros'),             -- Yordan Alvarez (Cycle), 2025
    ('nolan-arenado-cycle-2023', 'cardinals'),           -- Nolan Arenado (Cycle), 2023
    ('aaron-hill-bicycle-2013', 'diamondbacks'),         -- Aaron Hill (#BiCycle), 2013
    ('community-padres-wil-myers-640ed77d', 'padres'),   -- Wil Myers (Cycle) [community]
    ('wyatt-langford-cycle-2025', 'rangers'),            -- Wyatt Langford (Cycle), 2025
    ('nolan-arenado-walk-off-cycle-2018', 'rockies')     -- Nolan Arenado (Walk-Off Cycle), 2018
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('world-series', 'World Series')
on conflict (slug) do nothing;

-- World Series -- 32 listings.
-- Appearances, MVPs, moments, replica rings and trophies.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'world-series'
from (
  values
    ('george-springer-ws-champ-2018', 'astros'),                                     -- George Springer (WS Champ), 2018
    ('orbit-ws-flag-2023', 'astros'),                                                -- Orbit (WS Flag), 2023
    ('blooper-world-series-2022', 'braves'),                                         -- BLOOPER (World Series), 2022
    ('brian-snitker-world-series-trophy-2022', 'braves'),                            -- Brian Snitker (World Series Trophy), 2022
    ('ben-zobrist-world-series-mvp-2017', 'cubs'),                                   -- Ben Zobrist (World Series MVP), 2017
    ('cody-bellinger-world-series-mvp-2021', 'dodgers'),                             -- Cody Bellinger World Series MVP, 2021
    ('corey-seager-world-series-mvp-2021', 'dodgers'),                               -- Corey Seager World Series MVP, 2021
    ('freddie-freeman-world-series-grand-slam-walkoff-2025', 'dodgers'),             -- Freddie Freeman (World Series Grand Slam Walkoff), 2025
    ('jeff-kent-2002-world-series-reunion-2012', 'giants'),                          -- Jeff Kent (2002 World Series Reunion), 2012
    ('mike-lowell-10th-anniversary-world-series-2013', 'marlins'),                   -- Mike Lowell (10th Anniversary World Series), 2013
    ('1986-world-series-championship-2015', 'mets'),                                 -- 1986 World Series Championship, 2015
    ('daniel-hudson-world-series-2021-5-1', 'nationals'),                            -- Daniel Hudson (World Series), 2021
    ('daniel-hudson-world-series-2021-5-5', 'nationals'),                            -- Daniel Hudson (World Series), 2021
    ('davey-martinez-world-series-2021-4-3', 'nationals'),                           -- Davey Martinez (World Series), 2021
    ('davey-martinez-world-series-2021-6-28', 'nationals'),                          -- Davey Martinez (World Series), 2021
    ('eddie-murray-1983-world-series-2023', 'orioles'),                              -- Eddie Murray (1983 World Series), 2023
    ('adolis-garcia-replica-world-series-ring-2024', 'rangers'),                     -- Adolis García (Replica World Series Ring), 2024
    ('bruce-bochy-world-series-2025', 'rangers'),                                    -- Bruce Bochy (World Series), 2025
    ('community-rangers-corey-seager-909d5a94', 'rangers'),                          -- Corey Seager (2023 World Series Victory Speech Bobblehead) [community]
    ('corey-seager-2023-world-series-mvp-2024', 'rangers'),                          -- Corey Seager (2023 World Series MVP), 2024
    ('corey-seager-replica-world-series-ring-2024', 'rangers'),                      -- Corey Seager (Replica World Series Ring), 2024
    ('marcus-semien-replica-world-series-ring-2024', 'rangers'),                     -- Marcus Semien (Replica World Series Ring), 2024
    ('nathan-eovaldi-replica-world-series-ring-2024', 'rangers'),                    -- Nathan Eovaldi (Replica World Series Ring), 2024
    ('nolan-ryan-george-w-hw-bush-2010-world-series-first-pitch-2021', 'rangers'),   -- Nolan Ryan, George W & HW Bush (2010 World Series First Pitch), 2021
    ('texas-rangers-mystery-replica-world-series-ring-2024', 'rangers'),             -- Texas Rangers (Mystery Replica World Series Ring), 2024
    ('world-series-replica-trophy-statue-2024', 'rangers'),                          -- World Series Replica Trophy (Statue), 2024
    ('alex-cora-world-series-2019', 'red-sox'),                                      -- Alex Cora (World Series), 2019
    ('nathan-eovaldi-world-series-2019', 'red-sox'),                                 -- Nathan Eovaldi (World Series), 2019
    ('community-royals-bret-saberhagen-and-salvador-perez-3d1e9299', 'royals'),      -- Bret Saberhagen and Salvador Perez (World Series MVPs) [community]
    ('bobby-jenks-world-series-moment-2015', 'white-sox'),                           -- Bobby Jenks (World Series Moment), 2015
    ('jermaine-dye-world-series-moment-2015', 'white-sox'),                          -- Jermaine Dye (World Series Moment), 2015
    ('scott-podsednik-world-series-moment-2015', 'white-sox')                        -- Scott Podsednik (World Series Moment), 2015
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('champions', 'Champions')
on conflict (slug) do nothing;

-- Champions -- 9 listings.
-- Championship teams and commemoratives. Batting champions are their own award and live under Batting Champion instead.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'champions'
from (
  values
    ('1985-nl-champions-john-tudor-danny-cox-joaquin-andujar-2025', 'cardinals'),     -- 1985 NL Champions (John Tudor, Danny Cox, Joaquin Andujar), 2025
    ('1985-nl-champions-vince-coleman-willie-mcgee-ozzie-smith-2025', 'cardinals'),   -- 1985 NL Champions (Vince Coleman, Willie McGee, Ozzie Smith), 2025
    ('world-champions-postseason-heroes-affeldt-ishikawa-panik-2015', 'giants'),      -- World Champions Postseason Heroes (Affeldt/Ishikawa/Panik), 2015
    ('world-champions-postseason-heroes-crawford-belt-petit-2015', 'giants'),         -- World Champions Postseason Heroes (Crawford/Belt/Petit), 2015
    ('1986-world-series-championship-2015', 'mets'),                                  -- 1986 World Series Championship, 2015
    ('1924-championship-2024', 'nationals'),                                          -- 1924 Championship, 2024
    ('jamie-moyer-nl-east-champions-2008', 'phillies'),                               -- Jamie Moyer (NL East Champions), 2008
    ('2013-world-championship-2023', 'red-sox'),                                      -- 2013 World Championship, 2023
    ('george-brett-bret-saberhagen-1985-championship-2025', 'royals')                 -- George Brett & Bret Saberhagen (1985 Championship, Theme Ticket), 2025
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('perfect-game', 'Perfect Game')
on conflict (slug) do nothing;

-- Perfect Game -- 4 listings.
-- Koufax, Browning, Felix Hernandez and Kenny Rogers -- all four in the catalog.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'perfect-game'
from (
  values
    ('sandy-koufax-perfect-game-2015', 'dodgers'),                   -- Sandy Koufax Perfect Game, 2015
    ('felix-hernandez-perfect-game-2013', 'mariners'),               -- Felix Hernandez ("Perfect Game"), 2013
    ('kenny-rogers-top-moments-the-perfect-game-2019', 'rangers'),   -- Kenny Rogers (Top Moments - The Perfect Game), 2019
    ('tom-browning-perfect-game-2008', 'reds')                       -- Tom Browning (Perfect Game), 2008
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('no-hitter', 'No Hitter')
on conflict (slug) do nothing;

-- No Hitter -- 13 listings.
-- Including Nolan Ryan's fifth and Homer Bailey's two.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'no-hitter'
from (
  values
    ('framber-no-hitter-2024', 'astros'),                               -- Framber Valdez (No Hitter), 2024
    ('mike-scott-no-hitter-2012', 'astros'),                            -- Mike Scott (No Hitter), 2012
    ('nolan-ryan-5th-no-hitter-2012', 'astros'),                        -- Nolan Ryan (’5th No Hitter’), 2012
    ('mike-fiers-no-hitter-2019', 'athletics'),                         -- Mike Fiers (No-Hitter), 2019
    ('sean-manaea-no-hitter-2018', 'athletics'),                        -- Sean Manaea (No-Hitter), 2018
    ('carlos-zambrano-no-hitter-statue-2009', 'cubs'),                  -- Carlos Zambrano (No-Hitter Statue), 2009
    ('clayton-kershaw-no-hitter-5-year-anniversary-2019', 'dodgers'),   -- Clayton Kershaw No Hitter 5-Year Anniversary, 2019
    ('fernando-valenzuela-no-hitter-june-29-1990-2012', 'dodgers'),     -- Fernando Valenzuela No-Hitter June 29, 1990, 2012
    ('jonathan-sanchez-no-hitter-2010', 'giants'),                      -- Jonathan Sanchez (No-Hitter), 2010
    ('jordan-zimmermann-no-hitter-2015', 'nationals'),                  -- Jordan Zimmermann (No-Hitter), 2015
    ('max-scherzer-no-hitter-1-2016', 'nationals'),                     -- Max Scherzer (No-Hitter, #1), 2016
    ('max-scherzer-no-hitter-2-2016', 'nationals'),                     -- Max Scherzer (No-Hitter, #2), 2016
    ('homer-bailey-dual-no-hitter-2014', 'reds')                        -- Homer Bailey (Dual No-Hitter), 2014
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('triple-crown', 'Triple Crown')
on conflict (slug) do nothing;

-- Triple Crown -- 1 listings.
-- One listing: Mickey Mantle. It is a batting feat, which is why it is not a three-figure Triple.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'triple-crown'
from (
  values
    ('mickey-mantle-triple-crown-2016', 'yankees')    -- Mickey Mantle (Triple Crown), 2016
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('announcers-broadcasters', 'Announcers/Broadcasters')
on conflict (slug) do nothing;

-- Announcers/Broadcasters -- 49 listings.
-- The booth: Scully, Uecker, Caray, Buck, Shannon, Brennaman and the rest, plus KMOX and the Rockies' Radio Broadcasters.
-- Boog Powell is a first baseman, not the Cubs' Boog Sciambi; Rex Hudler and
-- the Magrane/Mathews dual are there as players. Al Hrabosky is included --
-- the Mad Hungarian has been in the Cardinals booth far longer than he
-- pitched. Like Celebrity, this one is discovery-based rather than mechanical.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'announcers-broadcasters'
from (
  values
    ('bill-king-with-sound-season-ticket-holders-2003', 'athletics'),   -- Bill King (with Sound, Season Ticket Holders), 2003
    ('bob-uecker-2001', 'brewers'),                                     -- Bob Uecker, 2001
    ('bob-uecker-2012', 'brewers'),                                     -- Bob Uecker, 2012
    ('bob-uecker-2015', 'brewers'),                                     -- Bob Uecker, 2015
    ('bob-uecker-talking-2021', 'brewers'),                             -- Bob Uecker (Talking), 2021
    ('bob-uecker-wwe-2021', 'brewers'),                                 -- Bob Uecker (WWE), 2021
    ('harry-doyle-bob-uecker-2015', 'brewers'),                         -- Harry Doyle (Bob Uecker), 2015
    ('ueck-skywalker-bob-uecker-2023', 'brewers'),                      -- "Ueck Skywalker" (Bob Uecker), 2023
    ('al-hrabosky-2015', 'cardinals'),                                  -- Al Hrabosky, 2015
    ('al-hrabosky-wwe-2023', 'cardinals'),                              -- Al Hrabosky (WWE), 2023
    ('bob-costas-2018', 'cardinals'),                                   -- Bob Costas, 2018
    ('harry-caray-voice-chip-2015', 'cardinals'),                       -- Harry Caray (Voice Chip), 2015
    ('jack-buck-voice-chip-2014', 'cardinals'),                         -- Jack Buck (Voice Chip), 2014
    ('kmox-dual-2019', 'cardinals'),                                    -- KMOX (Dual), 2019
    ('mike-shannon-2022', 'cardinals'),                                 -- Mike Shannon, 2022
    ('mike-shannon-voice-chip-2013', 'cardinals'),                      -- Mike Shannon (Voice Chip), 2013
    ('boog-jd-talking-2023', 'cubs'),                                   -- Boog & JD (Talking), 2023
    ('harry-caray-2026', 'cubs'),                                       -- Harry Caray, 2026
    ('harry-caray-statue-2023', 'cubs'),                                -- Harry Caray (Statue), 2023
    ('jaime-jarrin-2013', 'dodgers'),                                   -- Jaime Jarrin, 2013
    ('vin-scully-2012', 'dodgers'),                                     -- Vin Scully, 2012
    ('vin-scully-2013', 'dodgers'),                                     -- Vin Scully, 2013
    ('vin-scully-2015', 'dodgers'),                                     -- Vin Scully, 2015
    ('vin-scully-2016', 'dodgers'),                                     -- Vin Scully, 2016
    ('vin-scully-2025', 'dodgers'),                                     -- Vin Scully, 2025
    ('duane-kuiper-2014', 'giants'),                                    -- Duane Kuiper, 2014
    ('jon-miller-2009', 'giants'),                                      -- Jon Miller, 2009
    ('mike-krukow-2016', 'giants'),                                     -- Mike Krukow, 2016
    ('tom-hamilton-2007', 'guardians'),                                 -- Tom Hamilton, 2007
    ('tom-hamilton-2025', 'guardians'),                                 -- Tom Hamilton, 2025
    ('gary-cohen-2022', 'mets'),                                        -- Gary Cohen, 2022
    ('gary-cohen-ron-darling-keith-hernandez-triple-2010', 'mets'),     -- Gary Cohen, Ron Darling & Keith Hernandez (Triple), 2010
    ('howie-rose-sound-2023', 'mets'),                                  -- Howie Rose (Sound), 2023
    ('keith-hernandez-2012', 'mets'),                                   -- Keith Hernandez, 2012
    ('keith-hernandez-2022', 'mets'),                                   -- Keith Hernandez, 2022
    ('ralph-kiner-bob-murphy-2003', 'mets'),                            -- Ralph Kiner & Bob Murphy, 2003
    ('ron-darling-2013', 'mets'),                                       -- Ron Darling, 2013
    ('ron-darling-2022', 'mets'),                                       -- Ron Darling, 2022
    ('community-padres-dick-enberg-3617a564', 'padres'),                -- Dick Enberg (Broadcasting HOF) [community]
    ('bob-prince-talking-2003', 'pirates'),                             -- Bob Prince (Talking), 2003
    ('steve-blass-dual-player-broadcaster-2019', 'pirates'),            -- Steve Blass (Dual Player/Broadcaster), 2019
    ('dewayne-staats-joe-magrane-talking-double-2006', 'rays'),         -- DeWayne Staats & Joe Magrane (Talking, Double), 2006
    ('joe-nuxhall-2004', 'reds'),                                       -- Joe Nuxhall, 2004
    ('joe-nuxhall-bronze-statue-2008', 'reds'),                         -- Joe Nuxhall (Bronze Statue), 2008
    ('marty-brennaman-joe-nuxhall-dual-2003', 'reds'),                  -- Marty Brennaman & Joe Nuxhall (Dual), 2003
    ('radio-broadcasters-double-2004', 'rockies'),                      -- Radio Broadcasters (Double), 2004
    ('denny-matthews-talking-2004', 'royals'),                          -- Denny Matthews (Talking), 2004
    ('community-white-sox-steve-stone-d7298cc3', 'white-sox'),          -- Steve Stone (Stormtrooper) [community]
    ('john-sterling-suzyn-waldman-talking-2022', 'yankees')             -- John Sterling & Suzyn Waldman (Talking), 2022
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- What landed: Cycle 8, World Series 32, Champions 9, Perfect Game 4, No Hitter 13, Triple Crown 1, Announcers/Broadcasters 49.
select slug, label, listing_count from public.tag_counts order by listing_count desc, label;

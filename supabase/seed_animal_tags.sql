-- Animals and Dogs.
--
-- Read narrowly and deliberately: an animal has to be on the bobblehead. The
-- catalog's animals are overwhelmingly team mascots, which already have a tag,
-- so folding them in would have made Animals a 128-listing near-duplicate of
-- Mascot rather than a way to find the Giants' Lunar New Year run or the dog a
-- pitcher brought to the park.
--
-- Every Dog is also an Animal. Idempotent; needs the widened key from
-- supabase/fix_bobblehead_tags_pk.sql.

insert into public.tags (slug, label)
values ('animals', 'Animals')
on conflict (slug) do nothing;

-- Animals -- 28 listings.
-- Bobbleheads that actually depict an animal. Nickname-only animals are out:
-- Pete Alonso's "Polar Bear", Josh Jung's "Jungle Cat" and Yasiel Puig's "Wild
-- Horse" are players. Rougned Odor's "Rougie & Smokey the Horse" is in, because
-- Smokey is a horse who is present.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'animals'
from (
  values
    ('carlos-lee-horse-in-arm-2009', 'astros'),                        -- Carlos Lee (Horse in Arm), 2009
    ('carlos-lee-rancher-on-horse-2007', 'astros'),                    -- Carlos Lee (Rancher on Horse), 2007
    ('mauricio-dubon-dogs-2025', 'astros'),                            -- Mauricio Dubon & Dogs, 2025
    ('verlander-dog-2024', 'astros'),                                  -- Verlander & Dog, 2024
    ('hank-barking-2016', 'brewers'),                                  -- Hank (Barking), 2016
    ('hank-mothers-day-2015', 'brewers'),                              -- Hank (Mother's Day), 2015
    ('hank-stitch-n-pitch-2015', 'brewers'),                           -- Hank (Stitch 'N Pitch), 2015
    ('dancing-bear-vip-2017', 'giants'),                               -- Dancing Bear (VIP), 2017
    ('grateful-dead-bear-2017', 'giants'),                             -- Grateful Dead Bear, 2017
    ('jerry-garcias-grateful-dead-dancing-bears-2011', 'giants'),      -- Jerry Garcia's Grateful Dead Dancing Bears, 2011
    ('portuguese-rooster-2019', 'giants'),                             -- Portuguese Rooster, 2019
    ('year-of-the-dog-2018', 'giants'),                                -- Year of the Dog, 2018
    ('year-of-the-monkey-2016', 'giants'),                             -- Year of the Monkey, 2016
    ('year-of-the-pig-2019', 'giants'),                                -- Year of The Pig, 2019
    ('year-of-the-rabbit-2023', 'giants'),                             -- Year of the Rabbit, 2023
    ('year-of-the-ram-2015', 'giants'),                                -- Year of the Ram, 2015
    ('year-of-the-rooster-2017', 'giants'),                            -- Year of The Rooster, 2017
    ('year-of-the-tiger-2022', 'giants'),                              -- Year of the Tiger, 2022
    ('vintage-marlin-boy-face-2000', 'marlins'),                       -- "Vintage Marlin" / Boy Face, 2000
    ('election-night-donkey-elephant-2016', 'nationals'),              -- Election Night (Donkey & Elephant), 2016
    ('joe-musgrove-dog-theo-2024', 'padres'),                          -- Joe Musgrove & Dog Theo, 2024
    ('brandon-nimmo-bull-riding-2026', 'rangers'),                     -- Brandon Nimmo (Bull Riding), 2026
    ('rougned-odor-rougie-smokey-the-horse-2018', 'rangers'),          -- Rougned Odor (Rougie & Smokey the Horse), 2018
    ('dancing-bear-2019', 'reds'),                                     -- Dancing Bear, 2019
    ('grateful-dead-dancing-bears-2016', 'reds'),                      -- Grateful Dead Dancing Bears, 2016
    ('community-royals-light-blue-dancing-bear-08008cc4', 'royals'),   -- Light Blue Dancing Bear [community]
    ('dancing-bear-2021', 'royals'),                                   -- Dancing Bear, 2021
    ('dancing-bear-2023', 'royals')                                    -- Dancing Bear, 2023
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('dogs', 'Dogs')
on conflict (slug) do nothing;

-- Dogs -- 7 listings.
-- Hank the Ballpark Pup -- the stray who wandered into Brewers camp in 2014 and
-- got three bobbleheads -- plus Musgrove's dog Theo, Dubon's dogs, Verlander's
-- dog and the Giants' Year of the Dog. Hank Aaron and Hank Blalock are men, and
-- the Brewers' Racing Hot Dog is a sausage. Snoopy is a beagle but stays under
-- Peanuts: someone browsing Dogs wants Hank, not a cartoon.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'dogs'
from (
  values
    ('mauricio-dubon-dogs-2025', 'astros'),     -- Mauricio Dubon & Dogs, 2025
    ('verlander-dog-2024', 'astros'),           -- Verlander & Dog, 2024
    ('hank-barking-2016', 'brewers'),           -- Hank (Barking), 2016
    ('hank-mothers-day-2015', 'brewers'),       -- Hank (Mother's Day), 2015
    ('hank-stitch-n-pitch-2015', 'brewers'),    -- Hank (Stitch 'N Pitch), 2015
    ('year-of-the-dog-2018', 'giants'),         -- Year of the Dog, 2018
    ('joe-musgrove-dog-theo-2024', 'padres')    -- Joe Musgrove & Dog Theo, 2024
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- Expect Animals 28, Dogs 7.
select slug, label, listing_count from public.tag_counts where slug in ('animals', 'dogs');

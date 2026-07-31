-- Retires Crossover, and splits "Gold" into the two things it actually means.
--
-- Crossover was seeded as a catch-all for licensed properties and never
-- earned a listing: Star Wars, Sesame Street, Hello Kitty, Game of Thrones,
-- Marvel and Peanuts each got their own tag, and between them they left it
-- nothing to hold that wasn't better named elsewhere.
--
-- Gold turned out to be two tags wearing one word -- the fielding award and
-- the finish on the object -- so it is two tags here. Gold is the finish,
-- keeping company with Audio and Bobblecard as a description of the thing.
-- Gold Glove is the award, alongside Hall of Fame and All-Star.
--
-- Idempotent. Needs the widened key from supabase/fix_bobblehead_tags_pk.sql.
-- Paste into the Supabase SQL editor.

-- bobblehead_tags references tags with `on delete cascade`, so dropping a tag
-- someone has since applied would take those assignments with it and say
-- nothing about it. Refuse rather than cascade -- it was empty when this was
-- written, and if that changed, that's a decision to make deliberately.
do $$
declare
  carried integer;
begin
  select count(*) into carried
  from public.bobblehead_tags
  where tag_slug = 'crossover';

  if carried > 0 then
    raise exception
      'crossover now carries % listing(s); deleting it would cascade them away. Reassign or delete them first.', carried;
  end if;

  delete from public.tags where slug = 'crossover';
end $$;

insert into public.tags (slug, label)
values ('gold', 'Gold')
on conflict (slug) do nothing;

-- Gold -- 9 listings.
-- The finish, not the award: gold-plated and gold-variant bobbleheads. Three of
-- these are Gold Glove bobbleheads that are themselves gold, so they carry both
-- tags. Eric Chavez's "6 Gold Gloves - Non Gold" says outright that it isn't
-- one, and Paul Goldschmidt matches a naive search four times over; neither is
-- here.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'gold'
from (
  values
    ('community-athletics-jermaine-dye--9b5a1fa6', 'athletics'),              -- Jermaine Dye  (White jersey (gold lettering) variant) [community]
    ('community-athletics-matt-olson-gold-variant--48c37cdd', 'athletics'),   -- Matt Olson (Gold Glove - Gold Variant) [community]
    ('matt-chapman-gold-glove-gold-2019', 'athletics'),                       -- Matt Chapman Gold Glove (Gold), 2019
    ('kirk-gibson-gold-limited-edition-1-of-350-2018', 'dodgers'),            -- Kirk Gibson Gold Limited Edition (1 of 350), 2018
    ('community-giants-matt-chapman-b15cb1ed', 'giants'),                     -- Matt Chapman (Gold Glove - All Gold) [community]
    ('community-giants-patrick-bailey-6c76e8ae', 'giants'),                   -- Patrick Bailey (Gold) [community]
    ('vintage-phillies-gold-base-variant-2015', 'phillies'),                  -- Vintage Phillies (Gold Base Variant), 2015
    ('golden-arenado-gnome-2014', 'rockies'),                                 -- Golden Arenado Bobblehead Gnome, 2014
    ('community-royals-gold-bobby-witt-jr--6677b942', 'royals')               -- Gold Bobby Witt Jr. (Record Breaker) [community]
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

insert into public.tags (slug, label)
values ('gold-glove', 'Gold Glove')
on conflict (slug) do nothing;

-- Gold Glove -- 37 listings.
-- The fielding award, from Bill Mazeroski and Ozzie Smith through to Jeremy Pena
-- and Jonah Heim. Includes Yadier Molina's Gold & Platinum Gloves and Adolis
-- Garcia's combined ALCS MVP/Gold Glove.
insert into public.bobblehead_tags (bobblehead_id, team_slug, tag_slug)
select v.bobblehead_id, v.team_slug, 'gold-glove'
from (
  values
    ('darin-erstad-gold-glove-2005', 'angels'),                               -- Darin Erstad (Gold Glove), 2005
    ('brad-ausmus-gold-glove-2003', 'astros'),                                -- Brad Ausmus (Gold Glove), 2003
    ('dubon-gold-glove-2024', 'astros'),                                      -- Mauricio Dubon (Gold Glove), 2024
    ('jose-altuve-gold-glove-2016', 'astros'),                                -- Jose Altuve (Gold Glove), 2016
    ('michael-bourn-catching-in-air-gold-glove-2010', 'astros'),              -- Michael Bourn (Catching in Air Gold Glove), 2010
    ('michael-bourn-gold-glove-back2back-2011', 'astros'),                    -- Michael Bourn (Gold Glove Back2Back), 2011
    ('pena-gold-glove-2023', 'astros'),                                       -- Jeremy Pena (Gold Glove), 2023
    ('community-athletics-matt-olson-gold-variant--48c37cdd', 'athletics'),   -- Matt Olson (Gold Glove - Gold Variant) [community]
    ('eric-chavez-6-gold-gloves-non-gold-2007', 'athletics'),                 -- Eric Chavez (6 Gold Gloves - Non Gold), 2007
    ('eric-chavez-gold-glove-2002', 'athletics'),                             -- Eric Chavez Gold Glove, 2002
    ('matt-chapman-gold-glove-2019', 'athletics'),                            -- Matt Chapman Gold Glove, 2019
    ('matt-chapman-gold-glove-gold-2019', 'athletics'),                       -- Matt Chapman Gold Glove (Gold), 2019
    ('matt-olson-gold-glove-2019', 'athletics'),                              -- Matt Olson (Gold Glove), 2019
    ('ender-inciarte-gold-glove-2018', 'braves'),                             -- Ender Inciarte (Gold Glove), 2018
    ('carlos-gomez-gold-glove-2014', 'brewers'),                              -- Carlos Gomez (Gold Glove), 2014
    ('lorenzo-cain-gold-glove-2021', 'brewers'),                              -- Lorenzo Cain (Gold Glove), 2021
    ('ozzie-smith-gold-glove-2013', 'cardinals'),                             -- Ozzie Smith (Gold Glove), 2013
    ('yadier-molina-gold-platinum-gloves-2015', 'cardinals'),                 -- Yadier Molina (Gold & Platinum Gloves), 2015
    ('gabriel-moreno-2024', 'diamondbacks'),                                  -- Gabriel Moreno (Gold Glove), 2024
    ('orlando-hudson-gold-glove-2007', 'diamondbacks'),                       -- Orlando Hudson (Gold Glove), 2007
    ('adrian-gonzalez-2014-gold-glove-2015', 'dodgers'),                      -- Adrián González 2014 Gold Glove, 2015
    ('community-giants-matt-chapman-b15cb1ed', 'giants'),                     -- Matt Chapman (Gold Glove - All Gold) [community]
    ('grady-sizemore-gold-glove-2008', 'guardians'),                          -- Grady Sizemore (Gold Glove), 2008
    ('community-marlins-javier-sanoja-3273270b', 'marlins'),                  -- Javier Sanoja (Gold Glove - Mini) [community]
    ('community-padres-ha-seong-kim-ff30e622', 'padres'),                     -- Ha-Seong Kim (Gold Glove) [community]
    ('bill-mazeroski-gold-glove-2022', 'pirates'),                            -- Bill Mazeroski (Gold Glove), 2022
    ('adolis-garcia-alcs-mvp-gold-glove-2024', 'rangers'),                    -- Adolis García (ALCS MVP/Gold Glove), 2024
    ('isiah-kiner-falefa-2020-gold-glove-award-winner-2021', 'rangers'),      -- Isiah Kiner-Falefa (2020 Gold Glove Award Winner), 2021
    ('ivan-pudge-rodriguez-gold-glove-s-2014', 'rangers'),                    -- Ivan "Pudge" Rodriguez Gold Glove (s), 2014
    ('joey-gallo-2020-gold-glove-award-winner-2021', 'rangers'),              -- Joey Gallo (2020 Gold Glove Award Winner), 2021
    ('jonah-heim-gold-glove-2024', 'rangers'),                                -- Jonah Heim (Gold Glove), 2024
    ('nathaniel-lowe-gold-glove-2024', 'rangers'),                            -- Nathaniel Lowe (Gold Glove), 2024
    ('tucker-barnhart-gold-glove-2018', 'reds'),                              -- Tucker Barnhart (Gold Glove), 2018
    ('nolan-arenado-gold-glove-2015', 'rockies'),                             -- Nolan Arenado (Gold Glove), 2015
    ('nolan-arenado-gold-glove-mine-2016', 'rockies'),                        -- Nolan Arenado (Gold Glove Mine), 2016
    ('community-royals-alex-gordon-606b1130', 'royals'),                      -- Alex Gordon (Gold Glove) [community]
    ('torii-hunter-gold-glove-2006', 'twins')                                 -- Torii Hunter (Gold Glove), 2006
) as v (bobblehead_id, team_slug)
on conflict (bobblehead_id, team_slug, tag_slug) do nothing;

-- Expect Crossover gone, Gold 9, Gold Glove 37.
select slug, label, listing_count from public.tag_counts order by listing_count desc, label;

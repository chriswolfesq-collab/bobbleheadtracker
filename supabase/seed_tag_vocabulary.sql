-- The starting vocabulary: the themes worth having a name for before anyone
-- has labelled anything with them. Seeding these is what stops the first rep
-- who reaches for one from inventing "Day of the Dead", "Dia de los Muertos"
-- and "Día De Los Muertos" as three separate tags in the same week -- the mess
-- the two-table shape in supabase/tags.sql exists to prevent, which it can
-- only prevent if the right label is already there to be clicked.
--
-- Seeded with no assignments. /tags lists only tags that are actually in use,
-- so these stay out of the public directory until something carries them; they
-- show up in the picker on a listing page, which is where they're needed.
--
-- Idempotent: re-running adds nothing and overwrites nothing. A slug already
-- present keeps the label it has, so this can't stomp a casing someone fixed
-- later. Paste into the Supabase SQL editor. Requires supabase/tags.sql first.
--
-- Labels are cased the way they should render, not the way they were typed --
-- "Game of Thrones" keeps its lowercase "of". The slug is derived by the same
-- rules as lib/tags.ts slugifyTag, including the diacritic fold that turns
-- "Día" into "dia" so the tag is reachable from a keyboard without an accent.

insert into public.tags (slug, label)
values
  ('game-of-thrones',        'Game of Thrones'),
  ('sesame-street',          'Sesame Street'),
  ('disney',                 'Disney'),
  ('dia-de-los-muertos',     'Día de los Muertos'),
  ('legends',                'Legends'),
  ('hall-of-fame',           'Hall of Fame'),
  ('celebrity',              'Celebrity'),
  ('sugar-skull',            'Sugar Skull'),
  ('mascot',                 'Mascot'),
  ('hello-kitty',            'Hello Kitty'),
  ('crossover',              'Crossover'),
  ('all-star',               'All-Star'),
  ('world-baseball-classic', 'World Baseball Classic'),
  ('record-holder-breaker',  'Record Holder/Breaker'),
  ('audio',                  'Audio'),
  ('bobblecard',             'Bobblecard')
on conflict (slug) do nothing;

-- The vocabulary as it now stands, unused tags included. Expect these 16 plus
-- Star Wars.
select slug, label, listing_count
from public.tag_counts
order by label;

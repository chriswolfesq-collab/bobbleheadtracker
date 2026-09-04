-- Size and type caps for the two photo buckets. Run once in the Supabase SQL
-- editor (or via the CLI); safe to re-run.
--
-- Why: uploads happen a moment BEFORE the submissions insert, so the
-- rate-limit trigger in rate_limit.sql never sees them — any signed-in
-- account could push arbitrarily large files of any type straight into
-- Storage. These caps are enforced by Storage itself at upload time, so they
-- hold no matter what client made the request.
--
-- 10 MB comfortably fits any phone photo (a 12MP JPEG is 4–6 MB) while
-- keeping a hostile account from filling the project's storage quota twenty
-- files at a time. The MIME list is exactly what the site can display:
-- next/image optimizes jpeg/png/webp/gif/avif and nothing else, so accepting
-- e.g. HEIC would only produce broken <img>s after approval. The client
-- mirrors these checks in lib/uploadValidation.ts for a friendly error
-- message; this is the backstop a hand-rolled request can't skip.

update storage.buckets
set
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id in ('bobblehead-pending', 'bobblehead-approved');

-- Run this once in the Supabase Dashboard SQL Editor, after
-- supabase/patent_ideas.sql. No local Supabase/CLI required.
--
-- Adds three content fields that used to be reused from the score-reason
-- text (concreteness/novelty/inventiveness reason) — this made the PPT and
-- result screen thin. These are independent, spec-perspective content the
-- app now asks Gemini for directly (see lib/gemini/patent-analysis.ts).
--
-- Existing rows keep these columns null; the screen and the PPT generator
-- both fall back to the old behavior for rows analyzed before this ran.

alter table public.patent_ideas
  add column if not exists features text[],
  add column if not exists prior_problems text,
  add column if not exists effects text[];

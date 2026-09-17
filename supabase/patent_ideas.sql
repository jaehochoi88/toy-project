-- Run this once in the Supabase Dashboard SQL Editor (Project > SQL Editor)
-- for project rqgxjmxsdbjfyjezizln, after supabase/setup.sql. No local
-- Supabase/CLI required.
--
-- One row per analyzed patent idea. Analysis (KIPRIS search + Gemini
-- judgment) runs synchronously in a Server Action and this row is written
-- once with either a completed result or a failed status, so there is no
-- separate "analyzing" state to model here.

create table if not exists public.patent_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Original user input, preserved so a failed analysis can be retried
  -- without asking the user to type it again.
  title text not null,
  original_input text not null,
  clarifications jsonb,

  status text not null check (status in ('completed', 'failed')),
  failed_step text check (failed_step in ('search', 'analysis')),
  error_message text,

  score integer check (score >= 0 and score <= 100),
  score_band text check (score_band in ('가능', '보완', '불가')),
  criteria jsonb,
  keywords text[],
  prior_arts jsonb,
  improvement_points text,
  diagram jsonb,

  created_at timestamptz not null default now()
);

alter table public.patent_ideas enable row level security;

-- Owner-only access, same pattern as profiles: a user can see and manage
-- only their own patent ideas.
create policy "Users can view their own patent ideas"
on public.patent_ideas for select
to authenticated
using ( (select auth.uid()) = user_id );

create policy "Users can insert their own patent ideas"
on public.patent_ideas for insert
to authenticated
with check ( (select auth.uid()) = user_id );

create policy "Users can update their own patent ideas"
on public.patent_ideas for update
to authenticated
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

create policy "Users can delete their own patent ideas"
on public.patent_ideas for delete
to authenticated
using ( (select auth.uid()) = user_id );

create index if not exists patent_ideas_user_id_created_at_idx
on public.patent_ideas (user_id, created_at desc);

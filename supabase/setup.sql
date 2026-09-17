-- Run this once in the Supabase Dashboard SQL Editor (Project > SQL Editor)
-- for project rqgxjmxsdbjfyjezizln. No local Supabase/CLI required.

-- One profile row per auth user, with a single editable display name.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
);

alter table public.profiles enable row level security;

-- Owner-only access: a user can see and edit only their own profile.
create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using ( (select auth.uid()) = id );

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );

-- Defense in depth: lets a user self-heal their own profile row via upsert
-- if it wasn't created by the trigger (e.g. they signed up before this
-- trigger existed). Still owner-only.
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check ( (select auth.uid()) = id );

-- Auto-create a profile row when a new auth user signs up (e.g. via Google).
-- SECURITY DEFINER is required here to bypass RLS during signup; search_path
-- is locked down and the function is only reachable via the trigger, not a
-- public RPC.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

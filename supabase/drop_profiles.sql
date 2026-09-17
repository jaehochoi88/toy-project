-- Run this once in the Supabase Dashboard SQL Editor to remove the
-- profiles/display-name feature (Settings page), which nothing in this app
-- actually reads. Replaces supabase/setup.sql, which only ever created this.
--
-- Safe to run even if some of these objects don't exist (drop ... if exists).

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles;

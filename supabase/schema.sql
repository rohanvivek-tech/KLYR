-- =========================================================
-- KLYR — Supabase database setup
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to run again.
-- =========================================================

-- Waitlist sign-ups -----------------------------------------
create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  city        text not null check (char_length(city) between 1 and 80),
  consent     boolean not null check (consent),   -- must have agreed to the Privacy Policy
  created_at  timestamptz not null default now()
);

-- One sign-up per email (case-insensitive). The website treats a repeat as success.
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

-- Row Level Security: visitors may ADD themselves, but nobody can read,
-- change or delete the list through the website's public key.
-- You view the list in Supabase → Table Editor → waitlist.
alter table public.waitlist enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist;
create policy "Anyone can join the waitlist"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Accounts --------------------------------------------------
-- Login, sign-up and password reset use Supabase Auth, which stores
-- users in its own secure auth.users table. Nothing to create here.

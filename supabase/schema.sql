-- Run in the Supabase SQL editor (or via `supabase db push`) after project creation.
-- See docs/architecture.md#data-model for the reasoning behind each choice.

create table profiles (
  id           uuid primary key references auth.users(id),
  display_name text,
  created_at   timestamptz not null default now()
);

create table exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  name        text not null,
  category    text,                          -- e.g. push / pull / legs / cardio
  is_archived boolean not null default false
);

create table workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  performed_at timestamptz not null default now(),
  notes        text
);

create table sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  set_index   int not null,
  reps        int not null check (reps > 0),
  weight      numeric not null check (weight >= 0),
  weight_unit text not null check (weight_unit in ('lb', 'kg')),
  rpe         numeric null
);

-- Invite-only allowlist, per docs/architecture.md#access-control.
-- Seed the two allowed emails manually after creating this table.
create table allowed_users (
  email text primary key
);

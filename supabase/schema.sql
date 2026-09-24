-- Run in the Supabase SQL editor (or via `supabase db push`) after project creation.
-- See docs/architecture.md#data-model for the reasoning behind each choice.
--
-- Applying to an already-provisioned database (workout_templates added after
-- the initial rollout): run the two new `create table` statements below, then
--   alter table workouts add column template_id uuid null references workout_templates(id);
--
-- Applying to an already-provisioned database (setup_notes added after the
-- initial rollout): run
--   alter table exercises add column setup_notes text;

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
  is_archived boolean not null default false,
  setup_notes text                           -- e.g. machine seat height, incline position
);

create table workout_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  name        text not null,
  is_archived boolean not null default false
);

create table workout_template_exercises (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  position    int not null,
  target_sets int null check (target_sets > 0)
);

create table workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id),
  template_id  uuid null references workout_templates(id),
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

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
--
-- Applying to an already-provisioned database (server-side set_index
-- trigger added after the initial rollout, backlog item 10): run the
-- `create or replace function set_sets_index` and `create trigger
-- sets_set_index` statements below (the `sets` table must already exist).

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

-- Backlog item 10: set_index must not be trusted from the client. Two
-- addSet calls fired close together (e.g. logging a superset) can both
-- read the same activeSets.value.length before either insert has landed,
-- so both rows would land with the same set_index. This trigger
-- recomputes set_index server-side, inside the same transaction as the
-- insert, so whatever the client sends is overwritten with the real
-- value. An advisory lock keyed on workout_id serializes concurrent
-- inserts for the same workout so they can't both read the same max()
-- before either commits.
create or replace function set_sets_index() returns trigger as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.workout_id::text));
  select coalesce(max(set_index), -1) + 1 into new.set_index
    from sets
    where workout_id = new.workout_id;
  return new;
end;
$$ language plpgsql;

create trigger sets_set_index
  before insert on sets
  for each row execute function set_sets_index();

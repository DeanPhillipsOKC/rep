-- Run after schema.sql. See docs/architecture.md#row-level-security.
-- This is the actual security boundary — application code is not.

alter table profiles      enable row level security;
alter table exercises     enable row level security;
alter table workouts      enable row level security;
alter table sets          enable row level security;
alter table allowed_users enable row level security;

create policy "own profile only" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "own rows only" on exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows only" on workouts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sets has no user_id of its own; ownership is inherited through its workout.
create policy "own sets only" on sets
  for all
  using (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );

-- No client access needed; only checked server-side during sign-up.
create policy "no client access" on allowed_users
  for all
  using (false)
  with check (false);

-- Verification step, not optional (docs/architecture.md#row-level-security):
-- sign in as user A and attempt to read/write user B's rows by ID directly
-- against the API. Confirm both fail before building anything on top of this.

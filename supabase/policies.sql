-- Run after schema.sql. See docs/architecture.md#row-level-security.
-- This is the actual security boundary — application code is not.

alter table profiles                    enable row level security;
alter table exercises                   enable row level security;
alter table workout_templates           enable row level security;
alter table workout_template_exercises  enable row level security;
alter table workouts                    enable row level security;
alter table sets                        enable row level security;
alter table push_subscriptions          enable row level security;

create policy "own profile only" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "own rows only" on exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own rows only" on workout_templates
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_template_exercises has no user_id of its own; ownership is
-- inherited through its template, same pattern as sets -> workouts below.
create policy "own template exercises only" on workout_template_exercises
  for all
  using (
    exists (
      select 1 from workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workout_templates t
      where t.id = workout_template_exercises.template_id
        and t.user_id = auth.uid()
    )
  );

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

create policy "own rows only" on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Verification step, not optional (docs/architecture.md#row-level-security):
-- sign in as user A and attempt to read/write user B's rows by ID directly
-- against the API. Confirm both fail before building anything on top of this.

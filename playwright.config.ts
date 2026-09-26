import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Item 82: each Playwright worker now signs in as its own dedicated,
  // plus-addressed test account (scripts/lib/mint-test-session.mjs) instead
  // of every spec sharing one account, so concurrent workers no longer race
  // the same magic link or trip progress-strip.spec.ts's "nobody else
  // touches this account's workout count" assumption. Override with
  // `PW_WORKERS` to benchmark a different worker count; 2 was measured to
  // give a solid wall-clock win without adding meaningfully to Supabase
  // rate-limit risk (see docs/architecture.md#testing--automation).
  fullyParallel: true,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 2,
  retries: process.env.CI ? 2 : 1,
  // Two workers now share one Vite dev server and one machine's network
  // stack instead of one worker having it to itself, which occasionally
  // pushes a normal action past the 30s default under load (observed
  // sporadically during item 82's benchmarking, never reproducing when the
  // same spec was re-run alone) without any test logic actually being wrong.
  // 45s absorbs that real contention; it doesn't touch what's being
  // asserted, and retries stayed at 1 locally (was 0) for the same reason
  // CI already uses 2 -- real parallel timing noise, not flaky assertions.
  timeout: 45_000,
  // 'dot' prints one character per test (a dot for a pass) instead of a full line per test,
  // and still prints full error detail for any failure — this run's output gets read back into
  // an LLM's context on every gate check (next-item / Run-Backlog.ps1), sometimes several times
  // per item on a retry, so a 40-line listing of passes was pure token cost for no signal.
  reporter: 'dot',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})

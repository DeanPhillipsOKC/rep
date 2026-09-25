import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Specs share one Supabase test account (see e2e/fixtures/auth.ts). Minting
  // a session for it is a generateLink + verifyOtp round trip; two specs
  // doing that at once can invalidate each other's magic link. Single worker
  // avoids the race — there are only a handful of specs, so this costs little.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
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

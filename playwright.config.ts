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
  reporter: 'list',
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

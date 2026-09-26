import { test as base, expect } from '@playwright/test'
import { cleanupStamp } from '../../scripts/lib/cleanup-e2e-stamp.mjs'

// Backlog item 57: every spec stamps the entities it creates with a unique
// `E2E <thing> <stamp>` name so runs don't collide, but nothing ever deleted
// them afterward — the shared test account accumulated 1000+ rows over
// months, which silently truncates unbounded `.select()` queries at
// PostgREST's default page size (root cause of item 56's "random" failures).
// This fixture generates that stamp and, once the test (pass or fail) is
// done with it, deletes everything the stamp touched via the admin client
// (RLS is bypassed on purpose here — same trust level as session minting).
//
// The actual deletion logic lives in scripts/lib/cleanup-e2e-stamp.mjs so it
// can be shared with scripts/sweep-stale-e2e-rows.mjs (item 58), which catches
// stamps whose teardown here never got to run at all — e.g. the whole
// `playwright test` process being killed or timing out mid-run, which this
// fixture has no way to guard against since it only runs as part of a test
// that completes (pass or fail).
export const test = base.extend<{ stamp: number }>({
  stamp: async ({}, use) => {
    const stamp = Date.now() + Math.floor(Math.random() * 1000)
    await use(stamp)
    await cleanupStamp(stamp)
  },
})

export { expect }

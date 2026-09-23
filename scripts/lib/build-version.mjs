import { execSync } from 'node:child_process'

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

// Cloudflare Pages (and most CI checkouts) clone shallowly, which truncates
// `git rev-list --count`. Unshallow first so the commit count reflects full
// history; if that fails (offline, already complete, etc.) fall through and
// use whatever history is available rather than failing the build.
function ensureFullHistory(cwd) {
  try {
    if (run('git rev-parse --is-shallow-repository', cwd) === 'true') {
      execSync('git fetch --unshallow --quiet', { cwd, stdio: 'ignore' })
    }
  } catch {
    // best effort — fall back to whatever history is present
  }
}

/**
 * Build identifier derived purely from git, no external tooling: commit
 * count on the current branch plus the short SHA, e.g. "v142+a1b2c3d".
 * Not a semver bump — just a value that visibly changes on every deploy so
 * a stale service worker / build lag is obvious at a glance (docs/backlog.md item 10).
 */
export function getBuildVersion(cwd = process.cwd()) {
  try {
    ensureFullHistory(cwd)
    const count = run('git rev-list --count HEAD', cwd)
    const sha = run('git rev-parse --short HEAD', cwd)
    const dirty = run('git status --porcelain', cwd).length > 0
    return `v${count}+${sha}${dirty ? '-dirty' : ''}`
  } catch {
    return 'dev'
  }
}

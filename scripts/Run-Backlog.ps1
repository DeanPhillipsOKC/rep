<#
.SYNOPSIS
    Drives the /next-item Claude Code skill in a loop until docs/backlog.md is empty of
    eligible items or the run hits a wall.

.DESCRIPTION
    Each iteration runs `claude -p "/next-item"` headless. The skill picks the highest-ROI
    open backlog item, implements it, gates on `npm run build` + `npm run test:e2e`, and on
    green commits and pushes straight to main (see docs/backlog-runner.md and
    .claude/skills/next-item/SKILL.md). This script just keeps calling it, logs everything,
    and stops on BACKLOG_EMPTY, a stall (no commit for two runs in a row), or MaxIterations.

    This repo pushes straight to main by design (docs/architecture.md's commit & push
    policy) — this script does not gate on branch name, it just runs wherever it's invoked.

.PARAMETER MaxIterations
    Maximum number of backlog items to attempt in this run. Default 50.

.PARAMETER UsageLimitWaitMinutes
    Minutes to sleep before retrying the same iteration after a Claude usage-limit message.
    Default 30.
#>

param(
    [int]$MaxIterations = 50,
    [int]$UsageLimitWaitMinutes = 30
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeCmd) {
    Write-Error "Run-Backlog.ps1: 'claude' is not on PATH. Install the Claude Code CLI and try again."
    exit 1
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Run-Backlog.ps1: running on branch '$currentBranch' (this repo pushes straight to main by design; no branch gate)."

$logDir = Join-Path $RepoRoot 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir 'backlog-runner.log'

$gitignorePath = Join-Path $RepoRoot '.gitignore'
$gitignoreContent = if (Test-Path $gitignorePath) { Get-Content $gitignorePath -Raw } else { '' }
if ($gitignoreContent -notmatch '(?m)^logs/?\s*$') {
    Add-Content -Path $gitignorePath -Value "`nlogs/" -Encoding utf8
    Write-Host "Run-Backlog.ps1: added 'logs/' to .gitignore."
    # Commit this immediately (only .gitignore, nothing else) so the tree is clean before the
    # loop starts — next-item's safety precondition refuses to run on a dirty tree, and this
    # script's own edit would otherwise be the thing that dirties it.
    git add .gitignore
    git commit -m "Add logs/ to .gitignore (Run-Backlog.ps1)" | Out-Null
    git push | Out-Null
}

function Get-HeadCommit {
    (git rev-parse HEAD).Trim()
}

$lastCommit = Get-HeadCommit
$iteration = 0
$attemptsThisIteration = 0
$completed = 0
$blocked = 0
$consecutiveNoCommit = 0
$stopReason = 'max iterations reached'
$exitCode = 0

while ($iteration -lt $MaxIterations) {
    $iteration++
    $attemptsThisIteration++
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    $tmpFile = Join-Path $env:TEMP "next-item-$PID-$iteration-$attemptsThisIteration.txt"
    & claude -p "/next-item" *> $tmpFile
    $output = Get-Content -Path $tmpFile -Raw -ErrorAction SilentlyContinue
    Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
    if (-not $output) { $output = '' }

    Add-Content -Path $logFile -Value "===== [$iteration] $timestamp =====" -Encoding utf8
    Add-Content -Path $logFile -Value $output -Encoding utf8
    Add-Content -Path $logFile -Value '' -Encoding utf8

    if ($output -match 'BACKLOG_EMPTY') {
        $stopReason = 'backlog empty'
        $iteration--
        break
    }

    # Best-effort match for Claude usage-limit messaging; adjust if the CLI's wording changes.
    if ($output -match '(?i)usage limit|rate limit.*try again|resets? at') {
        Write-Host "Run-Backlog.ps1: usage limit detected on iteration $iteration, waiting $UsageLimitWaitMinutes minute(s) before retrying the same iteration."
        Add-Content -Path $logFile -Value "[$timestamp] usage limit detected, waiting $UsageLimitWaitMinutes minute(s)" -Encoding utf8
        $iteration--
        Start-Sleep -Seconds ($UsageLimitWaitMinutes * 60)
        continue
    }

    $attemptsThisIteration = 0

    $newCommit = Get-HeadCommit
    if ($newCommit -eq $lastCommit) {
        $consecutiveNoCommit++
        Write-Host "Run-Backlog.ps1: iteration $iteration produced no new commit (consecutive: $consecutiveNoCommit)."
        if ($consecutiveNoCommit -ge 2) {
            $stopReason = 'two consecutive runs produced no new commit'
            $exitCode = 1
            break
        }
    } else {
        $consecutiveNoCommit = 0
        $subject = (git log -1 --format='%s' $newCommit).Trim()
        if ($subject -match '^Block item') {
            $blocked++
            Write-Host "Run-Backlog.ps1: iteration $iteration blocked an item: $subject"
        } else {
            $completed++
            Write-Host "Run-Backlog.ps1: iteration $iteration completed: $subject"
        }
        $lastCommit = $newCommit
    }
}

Write-Host ''
Write-Host '===== Run-Backlog.ps1 summary ====='
Write-Host "Iterations run: $iteration"
Write-Host "Items completed: $completed"
Write-Host "Items blocked: $blocked"
Write-Host "Stopped because: $stopReason"
Write-Host "Log: $logFile"

exit $exitCode

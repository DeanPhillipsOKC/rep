<#
.SYNOPSIS
    Drives the next-item skill with Claude or Codex until docs/backlog.md is empty of
    eligible items or the run hits a wall.

.DESCRIPTION
    Each iteration runs the selected agent headless. The skill picks the highest-ROI
    open backlog item, implements it, gates on `npm run build` + `npm run test:e2e`, and on
    green commits and pushes straight to main (see docs/backlog-runner.md and
    corresponding next-item skill). This script just keeps calling it, logs everything,
    and stops on BACKLOG_EMPTY, a stall (no commit for two runs in a row), or MaxIterations.

    This repo pushes straight to main by design (docs/architecture.md's commit & push
    policy) — this script does not gate on branch name, it just runs wherever it's invoked.

.PARAMETER MaxIterations
    Maximum number of backlog items to attempt in this run. Default 50.

.PARAMETER UsageLimitWaitMinutes
    Minutes to sleep before retrying the same iteration after a usage-limit message.
    Default 30.

.PARAMETER Agent
    Claude (default) or Codex.

.NOTES
    Optional email notifications: set GMAIL_SENDER_ADDRESS, GMAIL_APP_PASSWORD, and
    NOTIFY_EMAIL_RECIPIENTS in .env.local (see docs/backlog-runner.md) to get an email each time
    an item ships or gets blocked, plus one when the run finishes. Unset means notifications are
    silently skipped — this is opt-in and never blocks a run.
#>

param(
    [int]$MaxIterations = 50,
    [int]$UsageLimitWaitMinutes = 30,
    [ValidateSet('Claude', 'Codex')][string]$Agent = 'Claude'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$envLocalPath = Join-Path $RepoRoot '.env.local'
if (Test-Path $envLocalPath) {
    Get-Content $envLocalPath | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $name, $value = $matches[1], $matches[2]
            if (-not (Test-Path "Env:$name")) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
}

function Send-EmailNotification {
    param([string]$Subject, [string]$Body)

    if (-not $env:GMAIL_SENDER_ADDRESS -or -not $env:GMAIL_APP_PASSWORD -or -not $env:NOTIFY_EMAIL_RECIPIENTS) {
        return
    }
    $recipients = $env:NOTIFY_EMAIL_RECIPIENTS -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    if (-not $recipients) {
        return
    }

    try {
        $smtp = New-Object System.Net.Mail.SmtpClient('smtp.gmail.com', 587)
        $smtp.EnableSsl = $true
        $smtp.Credentials = New-Object System.Net.NetworkCredential($env:GMAIL_SENDER_ADDRESS, $env:GMAIL_APP_PASSWORD)
        $mail = New-Object System.Net.Mail.MailMessage
        $mail.From = $env:GMAIL_SENDER_ADDRESS
        foreach ($recipient in $recipients) { $mail.To.Add($recipient) }
        $mail.Subject = $Subject
        $mail.Body = $Body
        $smtp.Send($mail)
        $mail.Dispose()
    } catch {
        Write-Host "Run-Backlog.ps1: email notification failed: $_"
    }
}

$agentCommand = $Agent.ToLowerInvariant()
if (-not (Get-Command $agentCommand -ErrorAction SilentlyContinue)) {
    Write-Error "Run-Backlog.ps1: '$agentCommand' is not on PATH."
    exit 1
}

$gitSafeRoot = $RepoRoot.Replace('\', '/')
$gitArgs = @('-c', "safe.directory=$gitSafeRoot")
$currentBranch = (& git @gitArgs rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Run-Backlog.ps1: running on branch '$currentBranch' (this repo pushes straight to main by design; no branch gate)."

if ((& git @gitArgs status --porcelain)) {
    Write-Error 'Run-Backlog.ps1: working tree is not clean.'
    exit 1
}

$logDir = Join-Path $RepoRoot 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$logFile = Join-Path $logDir 'backlog-runner.log'

$gitignorePath = Join-Path $RepoRoot '.gitignore'
$gitignoreContent = if (Test-Path $gitignorePath) { Get-Content $gitignorePath -Raw } else { '' }
if ($gitignoreContent -notmatch '(?m)^logs/?\s*$') {
    Write-Error "Run-Backlog.ps1: add 'logs/' to .gitignore before running."
    exit 1
}

function Get-HeadCommit {
    (& git @gitArgs rev-parse HEAD).Trim()
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
    if ($Agent -eq 'Codex') {
        & codex exec --approve-for-me 'Use $next-item to work exactly one eligible backlog item.' *> $tmpFile
    } else {
        & claude -p '/next-item' *> $tmpFile
    }
    $agentExitCode = $LASTEXITCODE
    $output = Get-Content -Path $tmpFile -Raw -ErrorAction SilentlyContinue
    Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
    if (-not $output) { $output = '' }

    Add-Content -Path $logFile -Value "===== [$iteration] $timestamp =====" -Encoding utf8
    Add-Content -Path $logFile -Value $output -Encoding utf8
    Add-Content -Path $logFile -Value '' -Encoding utf8

    if ($agentExitCode -eq 0 -and $output -match '(?m)^BACKLOG_EMPTY\s*$') {
        $stopReason = 'backlog empty'
        $iteration--
        break
    }

    # Best-effort match for usage-limit messaging; adjust if a CLI's wording changes.
    if ($output -match '(?i)usage limit|rate limit.*try again|resets? at') {
        Write-Host "Run-Backlog.ps1: usage limit detected on iteration $iteration, waiting $UsageLimitWaitMinutes minute(s) before retrying the same iteration."
        Add-Content -Path $logFile -Value "[$timestamp] usage limit detected, waiting $UsageLimitWaitMinutes minute(s)" -Encoding utf8
        $iteration--
        Start-Sleep -Seconds ($UsageLimitWaitMinutes * 60)
        continue
    }

    $attemptsThisIteration = 0

    if ($agentExitCode -ne 0) {
        $stopReason = "$Agent exited with code $agentExitCode"
        $exitCode = 1
        break
    }

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
        $subject = (& git @gitArgs log -1 --format='%s' $newCommit).Trim()
        if ($subject -match '^Block item') {
            $blocked++
            Write-Host "Run-Backlog.ps1: iteration $iteration blocked an item: $subject"
            $backlogDiff = (& git @gitArgs diff "$lastCommit" "$newCommit" -- docs/backlog.md) -join "`n"
            $reasonLine = ($backlogDiff -split "`n" | Where-Object { $_ -match '^\+.*Status: blocked:' } | Select-Object -First 1)
            $reasonText = if ($reasonLine) { ($reasonLine -replace '^\+', '').Trim() } else { 'see logs/backlog-runner.log for detail.' }
            Send-EmailNotification -Subject "Backlog item blocked: $subject" -Body "$subject`n`n$reasonText"
        } else {
            $completed++
            Write-Host "Run-Backlog.ps1: iteration $iteration completed: $subject"
            $archiveDiff = (& git @gitArgs diff "$lastCommit" "$newCommit" -- docs/backlog-archive.md) -join "`n"
            $addedLines = ($archiveDiff -split "`n" | Where-Object { $_ -match '^\+[^+]' }) -join "`n"
            $description = ($addedLines -replace '^\+\s?', '').Trim()
            if (-not $description) { $description = $subject }
            Send-EmailNotification -Subject "Shipped: $subject" -Body $description
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

Send-EmailNotification -Subject "Backlog run finished ($completed shipped, $blocked blocked)" -Body @"
Iterations run: $iteration
Items completed: $completed
Items blocked: $blocked
Stopped because: $stopReason
"@

exit $exitCode

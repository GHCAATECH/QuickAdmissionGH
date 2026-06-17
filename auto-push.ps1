param(
  [string]$RepoPath = $PSScriptRoot,
  [int]$DebounceSeconds = 4
)

$ErrorActionPreference = 'Stop'

function Get-RepoToken([string]$Text) {
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
    return ([System.BitConverter]::ToString($sha1.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
  } finally {
    $sha1.Dispose()
  }
}

$repo = (Resolve-Path -LiteralPath $RepoPath).Path
$runtimeDir = Join-Path $env:TEMP 'qag-auto-push'
$null = New-Item -ItemType Directory -Force -Path $runtimeDir
$token = Get-RepoToken $repo
$pidFile = Join-Path $runtimeDir "$token.pid"
$logFile = Join-Path $runtimeDir "$token.log"

function Write-Log([string]$Message) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $logFile -Value "[$stamp] $Message"
}

function Remove-PidFile {
  if (Test-Path -LiteralPath $pidFile) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
  }
}

Set-Content -LiteralPath $pidFile -Value $PID
Write-Log "Auto-push watcher started for $repo"

Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
  Remove-PidFile
} | Out-Null

$script:pushRunning = $false
$script:pushQueued = $false

function Invoke-AutoPush {
  if ($script:pushRunning) {
    $script:pushQueued = $true
    return
  }

  $script:pushRunning = $true
  try {
    $branch = (& git -C $repo rev-parse --abbrev-ref HEAD).Trim()
    if ([string]::IsNullOrWhiteSpace($branch)) {
      Write-Log 'Skipped push: no current branch detected.'
      return
    }

    $status = & git -C $repo status --porcelain
    if (-not $status) {
      return
    }

    & git -C $repo add -A | Out-Null
    $status = & git -C $repo status --porcelain
    if (-not $status) {
      return
    }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    & git -C $repo commit -m "auto: sync $stamp" | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Log 'Commit skipped: git commit returned a non-zero exit code.'
      return
    }

    & git -C $repo push origin $branch | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Log "Pushed latest changes to origin/$branch"
    } else {
      Write-Log "Push failed for origin/$branch"
    }
  } catch {
    Write-Log ("Watcher error: " + $_.Exception.Message)
  } finally {
    $script:pushRunning = $false
    if ($script:pushQueued) {
      $script:pushQueued = $false
      $script:debounceTimer.Stop()
      $script:debounceTimer.Start()
    }
  }
}

$script:debounceTimer = [System.Timers.Timer]::new([Math]::Max($DebounceSeconds, 1) * 1000)
$script:debounceTimer.AutoReset = $false
Register-ObjectEvent -InputObject $script:debounceTimer -EventName Elapsed -Action {
  Invoke-AutoPush
} | Out-Null

$watcher = [System.IO.FileSystemWatcher]::new($repo)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, DirectoryName, LastWrite, CreationTime'
$watcher.EnableRaisingEvents = $true

function Register-WatchEvent([string]$EventName) {
  Register-ObjectEvent -InputObject $watcher -EventName $EventName -Action {
    $path = $Event.SourceEventArgs.FullPath
    if (-not $path) { return }
    if ($path -like "$repo\\.git\\*" -or $path -like "$repo/.git/*") { return }
    $script:debounceTimer.Stop()
    $script:debounceTimer.Start()
  } | Out-Null
}

'Changed','Created','Deleted','Renamed' | ForEach-Object { Register-WatchEvent $_ }

Invoke-AutoPush

while ($true) {
  Wait-Event -Timeout 5 | Out-Null
}

param(
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

$repo = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$runtimeDir = Join-Path $env:TEMP 'qag-auto-push'
$null = New-Item -ItemType Directory -Force -Path $runtimeDir
$token = Get-RepoToken $repo
$pidFile = Join-Path $runtimeDir "$token.pid"
$scriptPath = Join-Path $repo 'auto-push.ps1'

if (Test-Path -LiteralPath $pidFile) {
  $existingPid = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Output "Auto-push is already running (PID $existingPid)."
      exit 0
    }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

$proc = Start-Process powershell `
  -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$scriptPath`"","-RepoPath", "`"$repo`"","-DebounceSeconds",$DebounceSeconds) `
  -WindowStyle Hidden `
  -PassThru

Write-Output "Started auto-push watcher (PID $($proc.Id))."

param()

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
$token = Get-RepoToken $repo
$pidFile = Join-Path $runtimeDir "$token.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output 'Auto-push is not running.'
  exit 0
}

$targetPid = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if ($targetPid) {
  $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $targetPid -Force
    Write-Output "Stopped auto-push watcher (PID $targetPid)."
  } else {
    Write-Output 'Auto-push pid file was stale; cleaned it up.'
  }
}

Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue

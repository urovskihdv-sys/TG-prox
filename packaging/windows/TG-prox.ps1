param(
  [ValidateSet("connect", "serve", "connect-url")]
  [string]$Mode = "connect"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  Write-Error "TG-prox requires Node.js 18 or newer on PATH."
  exit 1
}

& $node.Path (Join-Path $scriptDir "app/cli.js") $Mode
exit $LASTEXITCODE

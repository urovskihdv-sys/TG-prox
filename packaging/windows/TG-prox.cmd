@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
if not defined TGPROX_REMOTE_CONFIG_URL set "TGPROX_REMOTE_CONFIG_URL=https://relay.unitops.pro:8443/config.json"
where node >nul 2>nul
if errorlevel 1 (
  echo TG-prox requires Node.js 18 or newer on PATH. 1>&2
  exit /b 1
)

node "%SCRIPT_DIR%app\cli.js" connect %*
exit /b %errorlevel%

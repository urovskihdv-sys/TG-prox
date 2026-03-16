@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo TG-prox requires Node.js 18 or newer on PATH. 1>&2
  exit /b 1
)

node "%SCRIPT_DIR%app\cli.js" connect-url %*
exit /b %errorlevel%

@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE=%SCRIPT_DIR%runtime\node\node.exe"
if not defined TGPROX_REMOTE_CONFIG_URL set "TGPROX_REMOTE_CONFIG_URL=https://relay.unitops.pro:8443/config.json"

if not exist "%NODE_EXE%" (
  echo TG-prox standalone runtime is missing node.exe. 1>&2
  exit /b 1
)

"%NODE_EXE%" "%SCRIPT_DIR%app\cli.js" connect-url %*
exit /b %errorlevel%

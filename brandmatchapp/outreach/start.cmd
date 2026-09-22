@echo off
REM One launch, nothing to remember.
REM
REM Double-click this. It installs what is missing, builds, and runs. Whether
REM it sends is decided once in config\settings.json, not by a flag typed here,
REM so a launch does the same thing every time.
setlocal
cd /d "%~dp0"

if not exist "config\settings.json" (
  echo No config\settings.json yet.
  echo Copy config\settings.example.json to config\settings.json and set your account.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing, once.
  call npm install --no-audit --no-fund || goto fail
)

call npm run build || goto fail
node dist\cli.js run %*
echo.
pause
exit /b 0

:fail
echo.
echo That did not build. The error is above.
pause
exit /b 1

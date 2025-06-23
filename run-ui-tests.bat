@echo off
set ENV=%1
if "%ENV%"=="" set ENV=testing

set MODE=%2
if "%MODE%"=="" set MODE=parallel

if /i "%MODE%"=="serial" (
    echo Running UI tests in SERIAL mode
    set WORKERS=1
) else (
    echo Running UI tests in PARALLEL mode
    set WORKERS=%3
    if "%WORKERS%"=="" set WORKERS=4
)

echo Environment: %ENV%
echo Workers: %WORKERS%
echo.

set API_ENV=%ENV%
npx playwright test --config=playwright.config.ts --workers=%WORKERS%

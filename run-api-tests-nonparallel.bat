@echo off
set ENV=%1
if "%ENV%"=="" set ENV=testing
echo Running API tests in non-parallel mode with a single worker
echo Environment: %ENV%
echo.
set API_ENV=%ENV%
call npm run test:api:serial

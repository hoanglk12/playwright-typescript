@echo off
set ENV=%1
if "%ENV%"=="" set ENV=testing
echo Running API tests with 8 workers (one per brand+region), sequential within each spec
echo Environment: %ENV%
echo.
set API_ENV=%ENV%
call npm run test:api

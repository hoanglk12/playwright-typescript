@echo off
echo Running API tests in non-parallel mode with a single worker
echo.
call npm run test:api:serial

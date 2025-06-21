@echo off
echo Running API tests in serial mode...
echo.
echo API environment: testing (using .env.testing if available)
echo API base URL: Restful Booker API 
echo Workers: 1 (non-parallel)
echo.
call npm run test:api:serial

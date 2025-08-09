@echo off
REM filepath: run-docker-tests.bat

echo 🐳 Starting Docker Multi-Browser Testing...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop.
    exit /b 1
)
echo ✅ Docker is running

REM Build Docker image
echo 📦 Building Docker image...
docker build -t playwright-framework .
if errorlevel 1 (
    echo ❌ Failed to build Docker image
    exit /b 1
)
echo ✅ Docker image built successfully

REM Load environment variables
if exist .env.docker (
    for /f "delims=" %%x in (.env.docker) do (set "%%x")
    echo ✅ Environment variables loaded
)

REM Run tests based on argument
if "%1"=="all" (
    echo 🚀 Running all browser tests...
    docker-compose up --abort-on-container-exit --remove-orphans
) else if "%1"=="chromium" (
    echo 🟢 Running Chromium tests...
    docker-compose run --rm playwright-chromium
) else if "%1"=="firefox" (
    echo 🟠 Running Firefox tests...
    docker-compose run --rm playwright-firefox
) else if "%1"=="webkit" (
    echo 🔵 Running WebKit tests...
    docker-compose run --rm playwright-webkit
) else if "%1"=="api" (
    echo ⚡ Running API tests...
    docker-compose run --rm playwright-api
) else if "%1"=="parallel" (
    echo 🔄 Running UI tests in parallel...
    docker-compose up playwright-chromium playwright-firefox playwright-webkit --abort-on-container-exit --remove-orphans
) else if "%1"=="dev" (
    echo 🔧 Starting development environment...
    docker-compose up playwright-dev -d
    echo ✅ Development container started. Use 'npm run docker:dev:shell' to access shell.
) else if "%1"=="clean" (
    echo 🧹 Cleaning up Docker resources...
    docker-compose down --volumes --remove-orphans
    docker system prune -f
    echo ✅ Cleanup completed
) else (
    echo ⚠️  Usage: %0 {all^|chromium^|firefox^|webkit^|api^|parallel^|dev^|clean}
    echo.
    echo Examples:
    echo   %0 all        - Run all browser tests
    echo   %0 chromium   - Run Chromium tests only
    echo   %0 firefox    - Run Firefox tests only
    echo   %0 webkit     - Run WebKit tests only
    echo   %0 api        - Run API tests only
    echo   %0 parallel   - Run UI tests in parallel
    echo   %0 dev        - Start development environment
    echo   %0 clean      - Clean up Docker resources
    exit /b 1
)

if %errorlevel% equ 0 (
    echo ✅ Docker tests completed successfully!
) else (
    echo ❌ Some tests failed. Check the output above.
    exit /b 1
)
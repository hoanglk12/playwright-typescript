# CI/CD Integration Guide

This project includes comprehensive CI/CD integration for GitLab CI, Azure DevOps, and GitHub Actions with enhanced cross-platform support and flexible test execution.

## Overview

The CI/CD pipelines are designed to:
- Run UI and API tests separately for better performance
- Support multiple environments (testing, staging, production)
- Cross-platform execution (Linux, Windows, macOS)
- Flexible test execution modes (parallel/serial)
- Generate comprehensive HTML reports
- Cache dependencies for faster builds
- Publish test results and artifacts

## Platform Support

### GitHub Actions (`.github/workflows/playwright.yml`)
- ✅ Enhanced configuration with shell script integration
- Runs on push/PR to main branches
- Supports manual triggering with environment selection
- Cross-platform testing (Ubuntu, Windows, macOS)
- Uses dedicated shell scripts for consistent execution
- Publishes reports to GitHub Pages

### GitLab CI (`.gitlab-ci.yml`)
- ✅ Configured with shell script integration
- Separate jobs for UI and API tests
- GitLab Pages integration for report publishing
- Smart path-based triggering

### Azure DevOps (`azure-pipelines.yml`)
- ✅ Multi-platform pipeline support
- Multi-stage pipeline with dependency management
- Comprehensive artifact publishing
- Combined report generation

## Test Execution Scripts

### Shell Scripts Overview

The project uses dedicated shell scripts for consistent test execution across platforms:

```
run-ui-tests.sh         # Linux/macOS UI tests
run-ui-tests.bat        # Windows UI tests
run-api-tests-nonparallel.sh  # Linux/macOS API tests
run-api-tests-serial.bat      # Windows API tests
```

### Script Parameters

**UI Test Scripts:**
- `ENV` (default: testing) - Test environment
- `MODE` (default: parallel) - Execution mode (parallel/serial)
- `WORKERS` (default: 4) - Number of parallel workers

**API Test Scripts:**
- Always run in serial mode with 1 worker
- Use environment-specific configuration

## Environment Configuration

The project uses environment-specific configuration files:

```
.env.testing     # Default testing environment
.env.staging     # Staging environment  
.env.production  # Production environment
```

### CI Environment Detection

The `environment.ts` file automatically detects CI environments:

```typescript
const isCI = process.env.CI === 'true' || 
              process.env.GITLAB_CI === 'true' || 
              process.env.TF_BUILD === 'True' || // Azure DevOps
              process.env.GITHUB_ACTIONS === 'true';
```

CI environments get increased timeouts and retry counts for stability.

## GitHub Actions Pipeline Features

### Enhanced Workflow Configuration

**Workflow Inputs:**
- Environment selection (testing/staging/production)
- Execution mode (parallel/serial)
- Worker count configuration
- Cross-platform matrix testing

**Key Features:**
- Shell script integration for consistent execution
- Cross-platform testing (Ubuntu, Windows, macOS)
- Environment-specific artifact naming
- Comprehensive test summary reporting
- Manual workflow dispatch with custom parameters

### Execution Matrix

```yaml
strategy:
   matrix:
     os: [ubuntu-latest, windows-latest, macos-latest]
   fail-fast: false
```

## Usage Examples

### Manual Workflow Dispatch

**GitHub CLI:**
```bash
# Run tests on staging environment with serial mode
gh workflow run playwright.yml -f environment=staging -f mode=serial -f workers=2

# Run tests on production environment with parallel mode
gh workflow run playwright.yml -f environment=production -f mode=parallel -f workers=8

# Run tests on default testing environment
gh workflow run playwright.yml
```
# Run all tests on staging with parallel mode
gh workflow run playwright.yml \
  -f environment=staging \
  -f mode=parallel \
  -f workers=6 \
  -f browser=chromium \
  -f test_type=both

# Run only UI tests on production with serial mode
gh workflow run playwright.yml \
  -f environment=production \
  -f mode=serial \
  -f workers=1 \
  -f browser=all \
  -f test_type=ui

# Run only API tests on testing environment
gh workflow run playwright.yml \
  -f environment=testing \
  -f test_type=api

# Run Firefox-only tests
gh workflow run playwright.yml \
  -f browser=firefox \
  -f mode=parallel \
  -f workers=
  
### Monitoring and Artifact Management
# View workflow runs with status
gh run list --workflow=playwright.yml --limit=10

# View detailed run information
gh run view <run-id>

# Download specific artifacts
gh run download <run-id> -n "ui-test-results-ubuntu-latest-staging-parallel"
gh run download <run-id> -n "combined-test-report-staging"

# Download all artifacts from a run
gh run download <run-id>

# View workflow logs for debugging
gh run view <run-id> --log

### Advanced Usage Examples
# Run tests with custom parameters for performance testing
gh workflow run playwright.yml \
  -f environment=staging \
  -f mode=parallel \
  -f workers=8 \
  -f browser=chromium \
  -f test_type=ui

# Run cross-browser compatibility tests
gh workflow run playwright.yml \
  -f environment=testing \
  -f mode=serial \
  -f workers=1 \
  -f browser=all \
  -f test_type=ui

**GitHub Web Interface:**
1. Navigate to Actions tab in your repository
2. Click "Playwright Tests" workflow
3. Click "Run workflow" button
4. Select desired parameters:
    - Environment: testing/staging/production
    - Mode: parallel/serial
    - Workers: 1-8

### Local Development

**Using Shell Scripts:**
```bash
# Linux/macOS - Run UI tests
./run-ui-tests.sh testing parallel 4
./run-ui-tests.sh staging serial 1
./run-ui-tests.sh production parallel 8

# Windows - Run UI tests
./run-ui-tests.bat testing parallel 4
./run-ui-tests.bat staging serial 1

# Linux/macOS - Run API tests
./run-api-tests-nonparallel.sh

# Windows - Run API tests
./run-api-tests-serial.bat
```

**Using PowerShell Script:**
```powershell
# Run all tests
.\run-tests.ps1 -TestType all -Environment testing

# Run only UI tests in parallel
.\run-tests.ps1 -TestType ui -Environment staging -Mode parallel -Workers 6

# Run only API tests
.\run-tests.ps1 -TestType api -Environment production
```

**Direct npm Commands:**
```bash
# UI tests with custom workers
npx playwright test --config=playwright.config.ts --workers=4

# API tests in serial mode
npx playwright test --config=api.config.ts --workers=1 --project=api

# Environment-specific testing
API_ENV=staging npx playwright test
```

### CI/CD Pipeline Examples

**Triggering from Git Events:**
```bash
# Push to main branch - triggers all tests
git push origin main

# Create PR - triggers all tests
git checkout -b feature/new-feature
git push origin feature/new-feature
# Create PR via GitHub web interface
```

**Monitoring Pipeline Status:**
```bash
# Check workflow runs
gh run list --workflow=playwright.yml

# View specific run details  
gh run view <run-id>

# Download test artifacts
gh run download <run-id>

# View workflow logs
gh run view <run-id> --log
```

### Advanced Configuration Examples

**Environment Variables:**
```bash
# Set custom API timeout for CI
export API_TIMEOUT=60000

# Set custom retry count
export API_RETRIES=3

# Enable debug mode
export DEBUG=true

# Custom base URL
export API_BASE_URL=https://custom-api.example.com
```

**Test Filtering:**
```bash
# Run specific test suites
npx playwright test --grep "login"
npx playwright test --grep "@smoke"

# Run tests with specific tags
npx playwright test --project=chromium --grep "@critical"

# Run tests for specific pages
npx playwright test tests/admin/ --workers=2
```

## Page Testing Enhancements

### Enhanced Page Loading Methods

The project includes comprehensive page loading utilities in `BasePage`:

```typescript
// Wait for complete page load with options
await homePage.waitForCompletePageLoad({
   waitForImages: true,
   waitForFonts: true,
   waitForAjax: true,
   customSpinner: '.page-loading-spinner'
});

// Wait for hamburger menu items to appear
await homePage.clickAndWaitForElementsWithAnimation(
   '[data-testid="hamburger-menu"]',
   '.menu-header',
   300 // Animation delay
);
```

### UI Interaction Examples

**Hamburger Menu Testing:**
```typescript
// Click hamburger menu and wait for all menu items
await page.clickElement('[data-testid="hamburger-menu"]');
await page.waitForAllElementsWithText('.menu-header');

// Verify menu colors
const backgroundColor = await page.getElementBackgroundColorHex('.highlighted-menu');
expect(backgroundColor).toBe('#003f64');
```

## Report Publishing

### GitHub Actions Artifacts
- **Naming Convention**: `ui-test-results-{os}-{environment}`
- **Retention**: 30 days
- **Content**: Test results, HTML reports, screenshots, videos
- **Download**: Via GitHub CLI or web interface

### Test Report Structure
```
artifacts/
├── ui-test-results-ubuntu-latest-testing/
│   ├── test-results/
│   ├── playwright-report/
│   └── screenshots/
├── ui-test-results-windows-latest-staging/
└── api-test-results/
     ├── api-results/
     └── api-report/
```

### Report Access Examples

**GitHub CLI:**
```bash
# List available artifacts
gh api repos/:owner/:repo/actions/artifacts

# Download specific artifact
gh run download <run-id> -n ui-test-results-ubuntu-latest-testing

# Download all artifacts from a run
gh run download <run-id>
```

**Programmatic Access:**
```bash
# Using curl with GitHub token
curl -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/repos/owner/repo/actions/artifacts
```

## Environment Setup Examples

### GitHub Repository Setup

**Required Secrets:**
```bash
# Optional: Custom API endpoints
STAGING_API_URL=https://staging-api.example.com
PRODUCTION_API_URL=https://api.example.com

# Optional: Authentication tokens
API_KEY=your-api-key
AUTH_TOKEN=your-auth-token
```

**Environment Files:**
```bash
# .env.testing
NODE_ENV=testing
API_BASE_URL=https://restful-booker.herokuapp.com
API_TIMEOUT=30000
API_RETRIES=0
DEBUG=false

# .env.staging
NODE_ENV=staging
API_BASE_URL=https://staging-api.example.com
API_TIMEOUT=45000
API_RETRIES=1
DEBUG=true

# .env.production
NODE_ENV=production
API_BASE_URL=https://api.example.com
API_TIMEOUT=60000
API_RETRIES=2
DEBUG=false
```

## Troubleshooting Examples

### Common Issues and Solutions

**1. Script Permission Issues:**
```bash
# Make scripts executable
chmod +x ./run-ui-tests.sh
chmod +x ./run-api-tests-nonparallel.sh

# Check script permissions
ls -la *.sh
```

**2. Browser Installation Issues:**
```bash
# Manual browser installation
npx playwright install --with-deps

# Check installed browsers
npx playwright install --dry-run

# Clear browser cache
rm -rf ~/.cache/ms-playwright
```

**3. Environment Detection Issues:**
```bash
# Test environment loading
node -e "console.log(require('./src/config/environment').getEnvironment())"

# Check environment variables
env | grep -E "(API_|NODE_|CI)"
```

**4. Test Execution Issues:**
```bash
# Run with debug output
DEBUG=true npm run test:ui

# Run single test file
npx playwright test tests/admin/login.spec.ts --debug

# Run with headed browser
npx playwright test --headed --timeout=0
```

### Performance Optimization

**Worker Configuration:**
```bash
# CPU-based worker calculation
WORKERS=50% ./run-ui-tests.sh testing parallel

# Custom worker counts for different environments
# Testing: 4 workers
# Staging: 2 workers  
# Production: 1 worker (serial)
```

**Parallel Execution Guidelines:**
- **UI Tests**: Use parallel mode for faster execution
- **API Tests**: Use serial mode to avoid conflicts
- **Cross-browser**: Limit workers to prevent resource exhaustion
- **CI Environment**: Reduce workers for stability

## Best Practices

### Script Usage
1. **Use shell scripts** for consistent execution across environments
2. **Set appropriate worker counts** based on system capabilities
3. **Use serial mode for API tests** to avoid race conditions
4. **Monitor resource usage** during parallel execution

### Environment Management
1. **Keep sensitive data in CI secrets**, not in code
2. **Use environment-specific configurations** for different deployment targets
3. **Test environment detection** locally before CI deployment
4. **Document environment requirements** for team members

### Monitoring and Maintenance
1. **Review test execution times** regularly
2. **Monitor failure rates** across different environments
3. **Update browser versions** periodically
4. **Clean up old artifacts** to manage storage

### Team Collaboration
1. **Use consistent naming conventions** for branches and environments
2. **Document custom configurations** in team wiki
3. **Share test reports** with stakeholders
4. **Maintain test data** for different environments

## Migration Notes

### From Direct Playwright Commands
```bash
# Before
npx playwright test --workers=4

# After
./run-ui-tests.sh testing parallel 4
```

### From Other CI Systems
- **Jenkins**: Update Jenkinsfile to use shell scripts
- **CircleCI**: Modify config.yml to call appropriate scripts
- **Travis CI**: Update .travis.yml with script execution
- **Azure DevOps**: Use script tasks instead of inline commands

### Environment Variable Migration
```bash
# Old format
PLAYWRIGHT_WORKERS=4

# New format  
WORKERS=4
PARALLEL_WORKERS=4
```

This enhanced documentation provides comprehensive guidance for using the CI/CD pipeline with practical examples and troubleshooting information.

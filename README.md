# Playwright TypeScript Framework - BankGuru Converted

A comprehensive Playwright TypeScript testing framework converted from a Maven hybrid framework for automated testing of BankGuru, NopCommerce, and other web applications.

## 🚀 Features

- **Multi-Application Support**: BankGuru, NopCommerce, Admin panels
- **Page Object Model**: Maintainable and reusable page objects
- **Environment Management**: Support for multiple environments (testing, development, staging, production)
- **Cross-Browser Testing**: Chromium, Firefox, WebKit support
- **Parallel Execution**: Configurable parallel test execution for faster results
- **CI/CD Integration**: GitHub Actions workflow replacing Jenkins
- **Comprehensive Reporting**: HTML, JSON, and JUnit reports
- **API Testing**: Complete API testing framework with authentication, status and data validation
- **TypeScript**: Full type safety and IntelliSense support
- **Environment Variables**: Complete configuration through .env files

## 📁 Project Structure

```
📦 playwright-typescript-framework/
├── 💻 src/                                 # Source Code & Framework Core
│   ├── 🔌 api/                             # API Testing Framework
│   │   ├── ⚡ ApiTest.ts                   # API Test Fixtures & Configuration
│   │   ├── 🚀 ApiClientExt.ts              # Enhanced API Client with Wrappers
│   │   └── 📡 services/                    # API Service Implementations
│   │       └── restful-device/
│   │           └── RestfulApiClient.ts     # RESTful Device API Client
│   │
│   ├── 📄 pages/                           # Page Object Model (POM)
│   │   ├── 👑 admin/                       # Admin Panel Pages
│   │   │   ├── 🔐 login-page.ts            # Admin Authentication Page
│   │   │   └── 🏭 page-generator.ts        # Admin Page Factory
│   │   │
│   │   └── 🌐 front-site/                  # Public Website Pages
│   │       └── 🏠 home-page.ts             # Frontend Landing Page
│   │
│   ├── 📊 data/                            # Test Data Management
│   │   ├── 👑 admin-data.ts                # Admin Test Data Generators
│   │   └── 🏠 home-data.ts                 # Homepage Test Data
│   │
│   └── 🛠️ utils/                           # Utility Functions & Helpers
│       ├── 🔧 helpers.ts                   # Common utility functions (random generators, formatters, retry logic)
│       └── 📋 test-logger.ts               # Test logging and reporting utilities
│
├── 📚 docs/                                # Documentation
│   ├── 🔌 API_TESTING.md                  # API Testing Guide
│   ├── 🔄 CI_CD_INTEGRATION.md            # CI/CD Integration Guide
│   └── 📖 README.md                       # Project Documentation
│
└── ⚙️ Configuration Files                  # Framework Configuration
    ├── 📦 package.json                    # Dependencies & npm Scripts
    └── 🎭 playwright.config.ts            # Main Playwright Configuration
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+ installed
- Git installed

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd playwright-converted
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install Playwright browsers**

   ```bash
   npx playwright install
   ```

4. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env file with your specific configurations
   ```

## 🎯 Running Tests

### Command Line Options

```bash
# Run all tests
npm test

# Run all tests with UI mode
npm run test:ui

# Run tests in headed mode (visible browser)
npm run test:headed

# Run tests in debug mode
npm run test:debug

# Run on specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run specific test file
npx playwright test tests/bankguru/login-register.spec.ts

# Generate and view HTML report
npm run report
```

### Environment Selection

Set the environment in your `.env` file:

```bash
NODE_ENV=testing    # testing, staging, production
ENV=testing
```

Or pass it as an environment variable:

```bash
NODE_ENV=staging npm test
```

## ⚡ Parallel Execution

The framework supports configurable parallel execution for faster test runs:

### Parallel Test Commands

```bash
# Auto-detect optimal worker count
npm run test:parallel

# Use maximum available workers (100% of CPU cores)
npm run test:parallel:max

# Run tests serially (one at a time)
npm run test:serial

# Environment-specific parallel execution
npm run test:parallel:testing
npm run test:parallel:dev

# Run with custom worker count
WORKERS=8 npm test
```

### Configuring Parallel Workers

Set `PARALLEL_WORKERS` in your environment files:

```bash
# .env.testing
PARALLEL_WORKERS=4        # Good for local development

# .env.development  
PARALLEL_WORKERS=2        # Conservative for dev environment

# .env.staging
PARALLEL_WORKERS=6        # Higher for staging tests

# .env.production
PARALLEL_WORKERS=1        # Serial execution for production validation
```

### Advanced Parallel Examples

```bash
# Run BankGuru tests in parallel
npx playwright test tests/bankguru --workers=4

# Run smoke tests in parallel
npm run test:smoke:parallel

# Run regression tests in parallel
npm run test:regression:parallel

# Run all browsers in parallel
npm run test:all-browsers

# Custom parallel configuration
PARALLEL_WORKERS=8 HEADLESS=true npm run test:testing
```

## 🔧 Environment Configuration

### Environment Files Structure

The framework uses multiple `.env` files for different environments:

```
.env.testing      # Default testing environment (demo sites)
.env.development  # Development environment 
.env.staging      # Staging environment
.env.production   # Production environment
```

### Key Environment Variables

```bash
# Application URLs
BANKGURU_URL=http://demo.guru99.com/V4/
NOPCOMMERCE_URL=https://demo.nopcommerce.com/
NOPCOMMERCE_ADMIN_URL=https://admin-demo.nopcommerce.com/
LIVEGURU_URL=http://live.demoguru99.com/
ADAIRS_URL=https://www.adairs.com.au/

# Test Configuration
TIMEOUT=30000             # Global test timeout (ms)
RETRIES=2                 # Number of retries on failure
HEADLESS=false            # Run browser in headless mode
PARALLEL_WORKERS=4        # Number of parallel workers

# Browser Configuration
DEFAULT_BROWSER=chromium  # Default browser for tests
VIEWPORT_WIDTH=1920       # Browser viewport width
VIEWPORT_HEIGHT=1080      # Browser viewport height

# Reporting Configuration
REPORT_DIR=test-results
HTML_REPORT_DIR=playwright-report
SCREENSHOT_MODE=only-on-failure
VIDEO_MODE=retain-on-failure
TRACE_MODE=on-first-retry

# API Configuration
API_BASE_URL=https://api-demo.guru99.com
API_TIMEOUT=15000
API_RETRIES=3

# Database Configuration (if needed)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_db
DB_USER=test_user
DB_PASSWORD=test_password
```

### Environment-Specific Test Execution

```bash
# Run tests in different environments
npm run test:testing      # Uses .env.testing
npm run test:development  # Uses .env.development
npm run test:staging      # Uses .env.staging
npm run test:production   # Uses .env.production

```

## 🔧 Configuration

### Environment Configuration

The framework supports multiple environments configured in `src/config/environment.ts`:

- **Testing**: Default environment with demo URLs
- **Staging**: Pre-production environment
- **Production**: Live environment

### Browser Configuration

Configure browsers in `playwright.config.ts`:

- **Desktop browsers**: Chrome, Firefox, Safari, Edge
- **Mobile browsers**: Mobile Chrome, Mobile Safari
- **Headless/Headed mode**: Configurable per environment

### Test Configuration

Key configuration options:

- **Parallel execution**: Enabled by default
- **Retries**: 2 retries on CI, 0 locally
- **Timeouts**: Configurable action and navigation timeouts
- **Screenshots**: On failure
- **Videos**: On failure
- **Traces**: On first retry

## 🧪 Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../../src/config/base-test';
import { BankGuruPageGenerator } from '../../src/pages/bankguru/page-generator';

test.describe('Test Suite Name', () => {
  test('TC_01 - Test description', async ({ bankGuruPage }) => {
    // Step 1: Navigate to page
    const homePage = BankGuruPageGenerator.getHomePage(bankGuruPage);
    await homePage.navigateToHomePage();
    
    // Step 2: Perform actions
    await homePage.clickLoginButton();
    
    // Step 3: Assertions
    expect(await homePage.isLoginFormDisplayed()).toBe(true);
  });
});
```

### Page Object Example

```typescript
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class SamplePage extends BasePage {
  private readonly loginButton = 'button[data-testid="login"]';
  
  constructor(page: Page) {
    super(page);
  }
  
  async clickLoginButton(): Promise<void> {
    await this.clickElement(this.loginButton);
  }
}
```

### Using Test Fixtures

The framework provides pre-configured page fixtures:

- `adminPage`: Pre-navigated to admin panel
- `environment`: Current environment configuration

## 📊 Reporting

### HTML Reports

Playwright generates comprehensive HTML reports with:

- Test execution timeline
- Screenshots and videos of failures
- Trace viewer for debugging
- Step-by-step test breakdown

Access reports:

```bash
npm run report
```

### CI/CD Reports

GitHub Actions automatically:

- Generates test reports
- Uploads artifacts
- Publishes HTML reports to GitHub Pages
- Sends notifications on failure

### Run with .bat/.sh

**Specify the mode: serial or parallel**
**Linux/Mac:**

```bash
# Parallel mode (default) - 4 workers
./run-ui-tests.sh staging

# Parallel mode - custom workers
./run-ui-tests.sh staging parallel 2

# Serial mode
./run-ui-tests.sh staging serial

# Testing environment, parallel, 6 workers
./run-ui-tests.sh testing parallel 6

```

**Windows:**

```bash
# Parallel mode (default) - 4 workers
run-ui-tests.bat staging

# Parallel mode - custom workers
run-ui-tests.bat staging parallel 2

# Serial mode
run-ui-tests.bat staging serial

# Testing environment, parallel, 6 workers
run-ui-tests.bat testing parallel 6

```

### 🎯 Best Practices

1. **Use Descriptive Steps**: Break down test actions into clear steps
2. **Add Context**: Include relevant parameters and environment info
3. **Categorize Tests**: Use appropriate epic/feature/story hierarchy
4. **Set Severity**: Assign proper severity levels to tests
5. **Include Links**: Reference test cases, bugs, or requirements
6. **Use Tags**: Enable flexible test filtering and organization

### 🆚 Comparison with Maven Framework

| Maven Framework | Playwright Framework |
|----------------|---------------------|
| TestNG Reports | Playwright HTML Reports |
| ReportNG Screenshots | Playwright Screenshots + Videos |
| Manual categorization | Automatic failure categorization |
| Basic test grouping | Test organization by projects |
| Limited trend analysis | Rich HTML reporting |
| Static configuration | Dynamic environment configuration |

### 🔧 Configuration

The Playwright configuration is located in `playwright.config.ts` and includes:

- Test and report directories
- Browser configurations
- Environment information
- Executor details for CI/CD

### 📈 Benefits

1. **Enhanced Visibility**: Rich, interactive reports with drill-down capabilities
2. **Better Debugging**: Detailed failure analysis with screenshots and videos
3. **Trend Analysis**: Historical data for identifying patterns
4. **Team Collaboration**: Shareable reports with clear test organization
5. **CI/CD Integration**: Seamless integration with automated pipelines
6. **Customization**: Flexible categorization and organization options

## 🔄 Migration from Maven Framework

### Key Changes

| Maven Framework | Playwright Framework |
|----------------|---------------------|
| TestNG | Playwright Test |
| Selenium WebDriver | Playwright |
| Java | TypeScript |
| Maven | npm |
| Jenkins | GitHub Actions |
| Page Factory | Page Object Model |
| WebDriverManager | Built-in browser management |

### Benefits of Migration

1. **Faster Execution**: Playwright's auto-waiting and parallel execution
2. **Better Debugging**: Built-in trace viewer and recording
3. **Modern Tooling**: TypeScript support and VS Code integration
4. **Simplified CI/CD**: GitHub Actions integration
5. **Cross-browser Testing**: Built-in support for multiple browsers
6. **Enhanced Reporting**: Rich HTML reports with multimedia

## 🤝 Contributing

1. Follow the established page object patterns
2. Use TypeScript best practices
3. Write comprehensive tests with proper assertions
4. Update documentation for new features
5. Ensure all tests pass before submitting PRs

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the existing documentation
2. Review the example tests
3. Create an issue with detailed description
4. Include error logs and configuration details

## 🎯 Roadmap

- [ ] Add API testing capabilities
- [ ] Implement visual regression testing
- [ ] Add performance testing features
- [ ] Enhance reporting with custom metrics
- [ ] Add Docker support for containerized testing

## ✅ Framework Implementation Summary

This section provides a comprehensive overview of all implemented features and capabilities in this converted Playwright TypeScript framework.

### 🔄 Conversion from Maven to Playwright

**Successfully migrated from:**

- **Maven Hybrid Framework** → **Playwright TypeScript Framework**
- **TestNG** → **Playwright Test Runner**
- **Jenkins Pipeline** → **GitHub Actions Workflow**
- **Java Page Objects** → **TypeScript Page Objects**
- **Properties Files** → **Environment Variables (.env files)**

### 🌍 Multi-Environment Configuration

**Complete environment separation achieved:**

#### Environment Files Structure

```
.env.testing      # Default testing environment (demo sites)
.env.development  # Development environment with dev URLs
.env.staging      # Staging environment configuration
.env.production   # Production environment settings
```

#### Environment Variables Coverage

- ✅ **Application URLs**: BankGuru, NopCommerce, Admin panels, APIs
- ✅ **Test Configuration**: Timeouts, retries, headless mode
- ✅ **Parallel Execution**: Worker count, performance settings
- ✅ **Browser Settings**: Viewport, default browser, device emulation
- ✅ **Reporting**: Report directories, screenshot/video modes
- ✅ **Database**: Connection strings and credentials (if needed)
- ✅ **API Configuration**: Base URLs, timeouts, retry logic

#### Environment Usage Examples

```bash
# Environment-specific test execution
npm run test:testing      # Uses .env.testing
npm run test:development  # Uses .env.development
npm run test:staging      # Uses .env.staging
npm run test:production   # Uses .env.production

# Application + Environment combinations
npm run test:bankguru:testing
npm run test:bankguru:dev
npm run test:nopcommerce:staging
```

### ⚡ Advanced Parallel Execution

**Comprehensive parallel testing capabilities:**

#### Parallel Execution Scripts

```bash
# Auto-detect optimal worker count
npm run test:parallel

# Use maximum available workers (100% CPU)
npm run test:parallel:max

# Environment-specific parallel execution
npm run test:parallel:testing
npm run test:parallel:dev

# Serial execution (debugging/troubleshooting)
npm run test:serial

# Custom worker count
WORKERS=8 npm test
WORKERS=50% npm test
```

#### Parallel Configuration Features

- ✅ **Dynamic Worker Allocation**: Based on environment and CI/CD context
- ✅ **Environment-Specific Workers**: Different worker counts per environment
- ✅ **CI/CD Optimization**: Reduced workers in CI for stability
- ✅ **Tag-Based Parallel**: Smoke and regression tests in parallel
- ✅ **Browser-Specific Parallel**: Multi-browser parallel execution

#### Performance Configurations

```bash
# .env.testing - Local development
PARALLEL_WORKERS=4        # Moderate for local testing

# .env.development - Dev environment
PARALLEL_WORKERS=2        # Conservative for dev stability

# .env.staging - Pre-production
PARALLEL_WORKERS=6        # Higher for thorough testing

# .env.production - Production validation
PARALLEL_WORKERS=1        # Serial for critical validation
```

### 🎯 Enhanced Test Execution Options

**Comprehensive test execution matrix:**

#### By Environment

- `npm run test:testing` - Demo environment testing
- `npm run test:development` - Development environment
- `npm run test:staging` - Staging environment validation
- `npm run test:production` - Production smoke tests

#### By Browser

- `npm run test:chromium` - Chrome/Chromium testing
- `npm run test:firefox` - Firefox testing
- `npm run test:webkit` - Safari/WebKit testing
- `npm run test:mobile` - Mobile browser testing
- `npm run test:all-browsers` - All browsers in parallel

#### By Test Type

- `npm run test:smoke` - Quick smoke tests
- `npm run test:regression` - Full regression suite
- `npm run test:smoke:parallel` - Parallel smoke tests
- `npm run test:regression:parallel` - Parallel regression

### NPM Scripts for Simple Execution

```bash
# Simple execution scripts (no parallel, single browser)
npm run test:simple                 # Run all tests, serial, chromium only
npm run test:simple:admin           # Run admin tests, serial, chromium only  
npm run test:simple:login           # Run login test, serial, chromium only
npm run test:simple:headed          # Run with visible browser
npm run test:simple:debug           # Run with detailed logging

# Original scripts for comparison
npm run test:serial                 # Run all tests serially (all browsers)
npm run test:parallel               # Run all tests in parallel
npm test                           # Default execution (respects environment config)
```

### When to Use Simple vs Parallel Execution

**Use Simple Execution (`--workers=1`) when:**

- 🐛 Debugging test failures
- 🖥️ Limited system resources
- 🔍 Investigating flaky tests
- 📊 Need stable, predictable results
- 🚀 Running on CI with limited resources
- 🎯 Testing specific functionality

**Use Parallel Execution when:**

- ⚡ Need fast feedback on large test suites
- 💪 Have sufficient system resources
- ✅ Tests are stable and well-isolated
- 🏭 Running full regression suites
- 🔄 Regular automated testing

## 🎯 Simple Test Execution (No Parallel, No Customizations)

For basic test execution without parallel processing, browser selection, or tags, use these simple commands:

### Basic Serial Execution

```bash
# Run specific test file in serial mode (simplest approach)
npx playwright test tests/admin/login.spec.ts --workers=1

# Run all tests in serial mode
npx playwright test --workers=1

# Run with default browser only (Chromium)
npx playwright test tests/admin/login.spec.ts --workers=1 --project=chromium

# Run in headed mode for debugging (visible browser)
npx playwright test tests/admin/login.spec.ts --workers=1 --headed

# Run with maximum logs for debugging
npx playwright test tests/admin/login.spec.ts --workers=1 --headed --reporter=list

# Run specific test by name pattern
npx playwright test --workers=1 --grep "TC_01"

# Generate HTML report after execution
npx playwright test tests/admin/login.spec.ts --workers=1 --reporter=html

---#### Run Test By Tag---
# Run all smoke tests
npx playwright test --grep "@smoke"

# Run critical tests only
npx playwright test --grep "@critical"

# Run UI tests
npx playwright test --grep "@ui"

# Run homepage tests
npx playwright test --grep "@homepage"

# Combine multiple tags (AND operation)
npx playwright test --grep "(?=.*@smoke)(?=.*@critical)"

# Exclude certain tags
npx playwright test --grep "@smoke" --grep-invert "@skip"
```

### Serial Execution with Environment

```bash
# Run in testing environment (default)
cross-env NODE_ENV=testing npx playwright test tests/admin/login.spec.ts --workers=1

# Run in development environment
cross-env NODE_ENV=development npx playwright test tests/admin/login.spec.ts --workers=1

# Run in staging environment
cross-env NODE_ENV=staging npx playwright test tests/admin/login.spec.ts --workers=1
```

### Quick Debug Commands

```bash
# Debug specific test (opens browser and pauses)
npx playwright test tests/admin/login.spec.ts --debug

# Run with UI mode (interactive test runner)
npx playwright test tests/admin/login.spec.ts --ui

# Run single test case only
npx playwright test tests/admin/login.spec.ts --workers=1 --grep "Successful login"

# Generate report after test
npx playwright test tests/admin/login.spec.ts --workers=1 && npx playwright show-report
```

### Override Configuration Temporarily

```bash
# Force headless mode regardless of environment
HEADLESS=true npx playwright test tests/admin/login.spec.ts --workers=1

# Force headed mode regardless of environment  
HEADLESS=false npx playwright test tests/admin/login.spec.ts --workers=1

# Increase timeout for slow environments
TIMEOUT=60000 npx playwright test tests/admin/login.spec.ts --workers=1

# Disable retries for quick feedback
RETRIES=0 npx playwright test tests/admin/login.spec.ts --workers=1
```

### Minimal Test Execution Examples

```bash
# Simplest possible execution
npx playwright test tests/admin/login.spec.ts --workers=1

# With visible browser for watching the test
npx playwright test tests/admin/login.spec.ts --workers=1 --headed

# With trace for debugging failures
npx playwright test tests/admin/login.spec.ts --workers=1 --trace=on

# Generate HTML report after execution
npx playwright test tests/admin/login.spec.ts --workers=1 --reporter=html
```

### Why Use Serial Execution?

- ✅ **Easier Debugging**: One test at a time, clearer logs
- ✅ **Resource Conservation**: Less CPU and memory usage
- ✅ **Stable Results**: No race conditions or resource conflicts
- ✅ **Simpler Troubleshooting**: Isolated test execution
- ✅ **CI/CD Friendly**: More predictable in limited resource environments

## 🔍 Troubleshooting Guide

### Common Issues and Solutions

#### Environment Loading Issues

```bash
# Issue: Environment not loading correctly
# Solution: Check .env file exists and has correct syntax
ls -la .env.*
cat .env.testing

# Issue: NODE_ENV not recognized on Windows
# Solution: Use cross-env (already included)
cross-env NODE_ENV=testing npm test
```

#### Parallel Execution Issues

```bash
# Issue: Tests failing in parallel but passing in serial
# Solution: Run with fewer workers or debug isolation
npm run test:serial
WORKERS=1 npm test

# Issue: Resource conflicts in parallel
# Solution: Adjust worker count based on system
WORKERS=2 npm test  # Conservative approach
```

#### Browser Issues

```bash
# Issue: Browsers not installed
# Solution: Install Playwright browsers
npm run install:browsers:deps

# Issue: Browser crashes in headless mode
# Solution: Run in headed mode for debugging
HEADLESS=false npm test
npm run test:headed
```

### Performance Optimization

#### Worker Count Guidelines

- **Local Development**: 2-4 workers
- **CI/CD Pipeline**: 2 workers (stability)
- **Staging Environment**: 4-6 workers
- **Powerful Machines**: Up to 100% of CPU cores

#### Memory Optimization

```bash
# For large test suites
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

## 📋 Best Practices

### Test Organization

1. **Group Related Tests**: Use `test.describe()` for logical grouping
2. **Independent Tests**: Ensure tests don't depend on each other
3. **Data Isolation**: Use unique test data for each test
4. **Environment Cleanup**: Clean up test data after execution

### Page Object Design

1. **Single Responsibility**: One page object per page/component
2. **Meaningful Names**: Use descriptive method and property names
3. **Wait Strategies**: Implement proper waiting in page objects
4. **Error Handling**: Handle expected errors gracefully

### Environment Management

1. **Sensitive Data**: Never commit production credentials
2. **Environment Validation**: Validate environment variables on startup
3. **Fallback Values**: Provide sensible defaults for optional variables
4. **Documentation**: Document all environment variables

### Parallel Execution

1. **Test Isolation**: Ensure tests can run independently
2. **Resource Management**: Avoid shared resources between tests
3. **Worker Scaling**: Start with fewer workers and scale up
4. **Monitoring**: Monitor system resources during execution

## 🚀 Advanced Usage

### Custom Environment Variables

```bash
# Create custom .env file
cp .env.testing .env.custom

# Use custom environment
NODE_ENV=custom npm test
```

### Debugging Specific Tests

```bash
# Debug single test with traces
npx playwright test tests/bankguru/login-register.spec.ts --debug --trace on

# Run specific test in headed mode
npx playwright test -g "TC_01" --headed
```

### CI/CD Integration Examples

```yaml
# GitHub Actions matrix strategy
strategy:
  matrix:
    environment: [testing, staging]
    browser: [chromium, firefox]
    include:
      - environment: testing
        workers: 4
      - environment: staging
        workers: 2
```

### Performance Monitoring

```bash
# Monitor test execution time
---Linux/Mac---
time npm run test:api

---Windows---
Measure-Command { npm run test:api }
```

# Run with detailed timing

npx playwright test --reporter=list --verbose

# Generate performance reports

npm test && npm run report

```

This comprehensive guide covers all aspects of the converted framework, from basic usage to advanced configurations and troubleshooting.

## 🔧 Global Setup and Teardown

The framework includes comprehensive global setup and teardown processes based on the Maven framework's BaseTest.java methods:

### Global Setup (Before All Tests)
Located in `src/config/global-setup.ts`, equivalent to `@BeforeTest` in Maven framework:

**Key Features:**
- ✅ **Environment Validation**: Validates all environment variables and URLs
- ✅ **Screenshot Cleanup**: Cleans previous test artifacts (equivalent to `deleteAllFilesInReportNGScreenshot()`)
- ✅ **Browser Validation**: Verifies browser installations and configurations
- ✅ **Directory Initialization**: Creates necessary test directories
- ✅ **Authentication Setup**: Prepares authentication states for different applications
- ✅ **Connectivity Testing**: Validates network connectivity to target applications
- ✅ **Resource Cleanup**: Removes previous test results and temporary files

**Setup Process:**
1. Environment configuration loading and validation
2. Cleanup of previous test artifacts and screenshots
3. Browser setup validation
4. Directory structure initialization
5. Authentication state preparation
6. External dependency validation
7. Network connectivity verification

### Global Teardown (After All Tests)
Located in `src/config/global-teardown.ts`, equivalent to `@AfterTest/@AfterClass` in Maven framework:

**Key Features:**
- ✅ **Browser Process Cleanup**: Closes all browser processes (equivalent to `closeBrowserAndDriver()`)
- ✅ **Driver Process Termination**: Kills remaining WebDriver processes on Windows/Linux/Mac
- ✅ **Report Generation**: Creates final test reports and summaries
- ✅ **Artifact Archiving**: Archives test results for long-term storage
- ✅ **Temporary File Cleanup**: Removes temporary files and authentication states
- ✅ **Test Summary Generation**: Creates detailed execution summary with statistics
- ✅ **Cleanup Validation**: Verifies all cleanup operations completed successfully

**Teardown Process:**
1. Browser and driver process termination
2. Final report generation and validation
3. Test summary file creation
4. Temporary file and authentication cleanup
5. Artifact archiving (in CI environments)
6. Execution summary display
7. Cleanup validation and verification

### Generated Artifacts

The global teardown creates a comprehensive test summary file (`test-summary.txt`) containing:
- Execution timestamp and environment details
- Configuration settings (browsers, timeouts, parallel workers)
- Report locations and access instructions
- Environment URLs and credentials used
- Quick commands for viewing results

### Example Output

```bash
🚀 Starting global setup...
🌍 Environment loaded: testing
🌐 Base URLs configured:
   - FrontSite: https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/
   - Admin: https://ff-fieldfishercom-qa-cms-a4axd5cbatb7g4eu.uksouth-01.azurewebsites.net/CMSPages/logon.aspx
🧹 Cleaning up screenshot folders...
   ✅ Cleaned 0 files from test-results/
🔍 Validating environment configuration...
   ✅ FrontSite URL validated: https://...
   ✅ Admin URL validated: https://...
🌐 Validating browser setup...
   ✅ Chromium browser validated
✅ Global setup completed successfully

🧹 Starting global teardown...
🔄 Closing browser processes...
   ✅ Browser processes cleanup completed
📊 Generating final reports...
   ✅ HTML report available at: playwright-report/index.html
   ✅ Test summary saved to: test-summary.txt
📈 Test Execution Summary:
   🌍 Environment: testing
   🌐 Browser: chromium
   👁️ Headless: No
   ⚡ Workers: 4
   ⏱️ Timeout: 30000ms
   🔄 Retries: 2
   📊 HTML Report: Generated

🎯 To view the detailed HTML report, run:
   npx playwright show-report
✅ Global teardown completed successfully
```

### Integration with CI/CD

The global setup and teardown are automatically integrated with:

- **GitHub Actions**: Artifact archiving and report publishing
- **Local Development**: Comprehensive logging and cleanup
- **Multiple Environments**: Environment-specific configurations
- **Parallel Execution**: Safe resource management across workers

### Comparison with Maven Framework

| Maven Framework (BaseTest.java) | Playwright Framework |
|--------------------------------|---------------------|
| `@BeforeTest deleteAllFilesInReportNGScreenshot()` | Global Setup: Screenshot cleanup |
| `@BeforeClass initBrowser()` | Global Setup: Browser validation |
| `@AfterClass closeBrowser()` | Global Teardown: Browser cleanup |
| `closeBrowserAndDriver()` | Global Teardown: Process termination |
| `closeDriverInstance()` | Global Teardown: Driver cleanup |
| `showBrowserConsoleLogs()` | Global Teardown: Log collection |

This comprehensive setup ensures reliable test execution and proper resource management across all test scenarios.

## 🌐 API Testing

The framework includes a powerful API testing solution that can be run independently from the UI tests.

For detailed documentation on the API testing capabilities, see [API_TESTING.md](API_TESTING.md).

### Key API Testing Features

- **Full HTTP Method Support**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Authentication**: Basic Auth, Bearer Token, API Key, and Custom Headers
- **Response Validation**: Status codes, JSON body validation, header validation
- **Data Extraction**: Easy extraction from JSON responses
- **Token Management**: Token sharing between tests
- **API Mocking**: Comprehensive API mocking for offline testing and error scenarios

### Running API Tests

```bash
# Run all API tests
npm run test:api

# Run API tests with debugging
npm run test:api:debug

# Run API tests with UI mode
npm run test:api:ui

# View API test report
npm run report:api
```

### API Test Examples

```typescript
// Basic API test
apiTest('verify user endpoint', async ({ apiClientExt }) => {
  const response = await apiClientExt.getWithWrapper('/users/1');
  await response.assertStatus(200);
  await response.assertJsonPath('name', expect.any(String));
});

// Authenticated API test
apiTest('create new resource', async ({ createClientExt }) => {
  const client = await createClientExt({ 
    authType: AuthType.BEARER,
    token: 'your-token'
  });
  
  const response = await client.postWithWrapper('/resources', { 
    name: 'New Resource' 
  });
  
  await response.assertStatus(201);
});
```

The API tests have their own GitHub Actions workflow and separate reporting for clear separation from UI tests.

## 🎭 API Mocking

The framework includes comprehensive API mocking capabilities for testing without real API dependencies.

For detailed documentation on API mocking, see [Guideline/API_MOCKING_GUIDE.md](Guideline/API_MOCKING_GUIDE.md).

### API Mocking Features

- **Response Mocking**: Mock successful and error responses
- **Error Scenarios**: 401, 403, 404, 500, rate limits, timeouts
- **Network Conditions**: Simulate slow networks and failures
- **GraphQL Support**: Mock GraphQL queries, mutations, and errors
- **Pagination**: Mock paginated API responses
- **Request/Response Interception**: Modify requests and responses on the fly
- **Conditional Mocking**: Different responses based on request data
- **Pre-built Mock Data**: Ready-to-use generators for users, products, orders, etc.

### Quick Start: API Mocking

```typescript
import { test } from '@playwright/test';
import { ApiMockHelper } from '../src/utils/api-mock-helper';
import { ApiMockService } from '../src/api/ApiMockService';
import { MockDataGenerators } from '../src/data/api/mock-data';

test('mock successful login', async ({ page }) => {
  const mockService = new ApiMockService(page);
  
  // Mock successful login response
  await mockService.mockSuccessfulLogin('test@example.com');
  
  // Navigate to login page
  await page.goto('https://example.com/login');
  
  // Fill in credentials
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  await page.click('#login-button');
  
  // Verify login success without calling real API
  await expect(page.locator('.welcome-message')).toBeVisible();
});
```

### Basic API Mocking Examples

```typescript
// Mock successful response
const mockHelper = new ApiMockHelper(page);
await mockHelper.mockSuccess(
  '**/api/users/1',
  MockDataGenerators.mockUser({ id: 1, name: 'John Doe' })
);

// Mock error response
await mockHelper.mockError(
  '**/api/users/999',
  'User not found',
  404
);

// Mock slow network (3 second delay)
await mockHelper.mockDelayed(
  '**/api/slow-endpoint',
  { data: 'Response' },
  3000
);

// Mock GraphQL query
await mockHelper.mockGraphQL(
  '**/graphql',
  'GetUser',
  { user: MockDataGenerators.mockUser() }
);

// Mock paginated response
const products = MockDataGenerators.mockProductList(100);
await mockHelper.mockPaginated('**/api/products', products, 10);
```

### Service Layer Mocking

```typescript
const mockService = new ApiMockService(page);

// E-commerce scenarios
await mockService.mockProductList(50);        // Mock product catalog
await mockService.mockGetCart(false);         // Mock cart with items
await mockService.mockAddToCart();            // Mock add to cart
await mockService.mockCreateOrder();          // Mock order creation
await mockService.mockOrderList(10);          // Mock order history

// Error scenarios
await mockService.mockUnauthorized();         // Mock 401 error
await mockService.mockForbidden();            // Mock 403 error
await mockService.mockRateLimit();            // Mock rate limit
await mockService.mockTimeout();              // Mock timeout

// Authentication
await mockService.mockSuccessfulLogin();      // Mock login success
await mockService.mockFailedLogin();          // Mock login failure
await mockService.mockUserRegistration();     // Mock registration
```

### Mock Data Generators

```typescript
// Generate mock data for testing
const user = MockDataGenerators.mockUser({
  email: 'custom@example.com',
  role: 'admin'
});

const product = MockDataGenerators.mockProduct({
  name: 'Custom Product',
  price: 99.99,
  stock: 100
});

const order = MockDataGenerators.mockOrder({
  status: 'shipped',
  total: 299.99
});

// Generate lists
const users = MockDataGenerators.mockUserList(20);
const products = MockDataGenerators.mockProductList(50);
const orders = MockDataGenerators.mockOrderList(10);

// Error responses
const notFoundError = MockDataGenerators.mockNotFoundError('User');
const validationError = MockDataGenerators.mockValidationError(['email', 'password']);
const serverError = MockDataGenerators.mockServerError();
```

### Advanced Mocking Scenarios

```typescript
// Conditional mocking based on request
await mockHelper.mockConditional('**/api/users', [
  {
    condition: { method: 'GET' },
    response: { status: 200, body: MockDataGenerators.mockUserList(10) }
  },
  {
    condition: { method: 'POST' },
    response: { status: 201, body: { message: 'User created' } }
  }
]);

// Intercept and modify request
await mockHelper.interceptRequest('**/api/**', async (request) => {
  const data = request.postDataJSON();
  return { ...data, timestamp: Date.now() };
});

// Intercept and modify response
await mockHelper.interceptResponse('**/api/products', async (response) => {
  return { ...response, cached: true };
});

// Wait for API calls
const request = await mockHelper.waitForApiCall('**/api/checkout');
const response = await mockHelper.waitForApiResponse('**/api/cart');

// Clear mocks
await mockHelper.clearMock('**/api/users');
await mockHelper.clearAllMocks();
```

### When to Use API Mocking

✅ **Use API Mocking when:**

- Testing UI without backend dependencies
- Simulating error scenarios (500, 404, 401, etc.)
- Testing slow network conditions
- Offline development and testing
- Testing edge cases that are hard to reproduce
- Avoiding rate limits during development
- Running tests without external API costs

❌ **Don't use API Mocking when:**

- Testing actual API integration
- Validating real API contracts
- End-to-end integration testing
- Performance testing with real APIs

### Running API Mock Tests

```bash
# Run API mocking examples
npx playwright test tests/api/api-mocking-examples.spec.ts

# Run with UI mode to see mocking in action
npx playwright test tests/api/api-mocking-examples.spec.ts --ui

# Run specific mock test
npx playwright test tests/api/api-mocking-examples.spec.ts --grep "mock successful login"
```

### Benefits of API Mocking

1. **Faster Tests**: No network latency or API delays
2. **Reliable Tests**: No flakiness from external API issues
3. **Offline Testing**: Work without internet connection
4. **Error Testing**: Easily simulate error scenarios
5. **Cost Savings**: Avoid API usage costs during testing
6. **Parallel Execution**: No rate limiting concerns
7. **Consistent Data**: Predictable test data every run

For comprehensive API mocking documentation, examples, and best practices, see [Guideline/API_MOCKING_GUIDE.md](Guideline/API_MOCKING_GUIDE.md).

---

## 🤝 Contributing
 - Hoang Pham - Sr Quality Engineer
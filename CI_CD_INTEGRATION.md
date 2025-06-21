# CI/CD Integration Guide

This project includes comprehensive CI/CD integration for GitLab CI, Azure DevOps, and GitHub Actions.

## Overview

The CI/CD pipelines are designed to:
- Run UI and API tests separately for better performance
- Support multiple environments (testing, staging, production)
- Generate comprehensive HTML reports
- Cache dependencies for faster builds
- Publish test results and artifacts

## Platform Support

### GitHub Actions (`.github/workflows/api-tests.yml`)
- ✅ Already configured
- Runs on push/PR to main branches
- Supports manual triggering with environment selection
- Publishes reports to GitHub Pages

### GitLab CI (`.gitlab-ci.yml`)
- ✅ Newly added
- Separate jobs for UI and API tests
- GitLab Pages integration for report publishing
- Smart path-based triggering

### Azure DevOps (`azure-pipelines.yml`)
- ✅ Newly added
- Multi-stage pipeline with dependency management
- Comprehensive artifact publishing
- Combined report generation

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

## Pipeline Features

### GitLab CI Pipeline

**Stages:**
1. **Install** - Dependencies and browser installation
2. **Test** - Parallel UI and API test execution
3. **Report** - GitLab Pages deployment

**Key Features:**
- Node.js caching for faster builds
- Path-based change detection
- JUnit test result integration
- Automatic Pages deployment on main branches

### Azure DevOps Pipeline

**Stages:**
1. **Install** - Dependency installation with caching
2. **UITests** - Browser-based test execution
3. **APITests** - API test execution in serial mode
4. **Publish** - Combined report generation

**Key Features:**
- Advanced artifact management
- HTML report publishing
- Build metadata integration
- Conditional stage execution

### Test Execution

**UI Tests:**
- Run with `npm run test:simple`
- Single browser (Chromium) for CI stability
- Non-parallel execution for consistency

**API Tests:**
- Run with `npm run test:api:serial`
- Serial execution to avoid conflicts
- Comprehensive Restful Booker API coverage

## Local CI Simulation

Use the PowerShell script to simulate CI behavior locally:

```powershell
# Run all tests
.\run-tests.ps1 -TestType all -Environment testing

# Run only UI tests
.\run-tests.ps1 -TestType ui -Environment testing

# Run only API tests  
.\run-tests.ps1 -TestType api -Environment testing
```

## Environment Variables

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment name | `testing` |
| `CI` | CI environment flag | `false` |
| `API_BASE_URL` | API endpoint | `https://restful-booker.herokuapp.com` |

### Optional Variables

| Variable | Description | CI Default | Local Default |
|----------|-------------|------------|---------------|
| `API_TIMEOUT` | Request timeout (ms) | `60000` | `30000` |
| `API_RETRIES` | Retry attempts | `2` | `0` |

## Report Publishing

### GitLab Pages
- Available at: `https://yourusername.gitlab.io/yourproject`
- Updates automatically on main branch pushes
- Includes both UI and API reports

### Azure DevOps
- Published as pipeline artifacts
- Available in the Azure DevOps interface
- Includes combined report with build metadata

### GitHub Actions
- Published to GitHub Pages (if configured)
- Available as workflow artifacts
- 30-day retention period

## Setup Instructions

### GitLab CI Setup
1. Ensure GitLab Pages is enabled for your project
2. The `.gitlab-ci.yml` file is automatically detected
3. Push to trigger the pipeline

### Azure DevOps Setup
1. Create a new pipeline in Azure DevOps
2. Select "Existing Azure Pipelines YAML file"
3. Choose `/azure-pipelines.yml`
4. Save and run the pipeline

### Environment Files
Create these files in your project root:

```bash
# .env.testing
NODE_ENV=testing
API_BASE_URL=https://restful-booker.herokuapp.com
API_TIMEOUT=30000
API_RETRIES=0

# .env.staging  
NODE_ENV=staging
API_BASE_URL=https://staging-api.example.com
API_TIMEOUT=45000
API_RETRIES=1

# .env.production
NODE_ENV=production
API_BASE_URL=https://api.example.com
API_TIMEOUT=60000
API_RETRIES=2
```

## Troubleshooting

### Common Issues

1. **Browser installation fails**
   - Ensure `npx playwright install --with-deps` runs successfully
   - Check if the CI environment has sufficient resources

2. **Tests timeout in CI**
   - Increase `API_TIMEOUT` for the environment
   - Check if the target API is accessible from CI

3. **Report publishing fails**
   - Verify artifact paths in pipeline configuration
   - Check permissions for Pages deployment

### Debug Commands

```bash
# Check environment loading
npm run test:api:serial -- --reporter=line

# Verify browser installation
npx playwright install --dry-run

# Test environment detection
node -e "console.log(require('./src/api/config/environment').getApiEnvironment())"
```

## Best Practices

1. **Use environment-specific configurations** for different deployment targets
2. **Keep sensitive data in CI variables**, not in code
3. **Monitor test execution times** and optimize as needed
4. **Review test reports regularly** to catch flaky tests
5. **Use serial execution for API tests** to avoid race conditions

## Migration Notes

If migrating from other CI systems:
- Update environment variable names to match your platform
- Adjust artifact paths based on your CI system's requirements
- Configure appropriate access permissions for report publishing

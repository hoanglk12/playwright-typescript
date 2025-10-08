# API Testing Guide

This guide explains how to run API tests in different environments using the provided scripts.

## Overview

The API test suite can be executed in non-parallel mode with a single worker to ensure consistent test execution. Tests can be run against different environments (testing, staging, production).

## Prerequisites

- Node.js and npm installed
- Playwright dependencies installed (`npm install`)
- Environment-specific configuration in `api.config.ts`

## Available Scripts

### Linux/Mac (Shell Script)
- `run-api-tests-nonparallel.sh`

### Windows (Batch File)
- `run-api-tests-nonparallel.bat`

## Usage

### Basic Usage (Default Environment: testing)

**Linux/Mac:**
```bash
./run-api-tests-nonparallel.sh
```

**Windows:**
```bash
run-api-tests-nonparallel.bat
```

### Environment-Specific Usage

**Linux/Mac:**
```bash
# Testing environment (default)
./run-api-tests-nonparallel.sh testing

# Staging environment
./run-api-tests-nonparallel.sh staging

# Production environment
./run-api-tests-nonparallel.sh production
```

**Windows:**
```bash
# Testing environment (default)
run-api-tests-nonparallel.bat testing

# Staging environment
run-api-tests-nonparallel.bat staging

# Production environment
run-api-tests-nonparallel.bat production
```

### CI/CD Usage

For CI environments, use the shell script with explicit environment:

```yaml
# GitHub Actions example
- name: Run API Tests
  run: |
    chmod +x ./run-api-tests-nonparallel.sh
    ./run-api-tests-nonparallel.sh staging
  shell: bash
```

```yaml
# GitLab CI example
api_tests:
  script:
    - chmod +x ./run-api-tests-nonparallel.sh
    - ./run-api-tests-nonparallel.sh $CI_ENVIRONMENT_NAME
```

## Configuration

### Environment Variables

The scripts set the `API_ENV` environment variable which is used by `api.config.ts` to determine the target API base URL.

### Supported Environments

- `testing` - Default test environment
- `staging` - Staging environment  
- `production` - Production environment

### Base URLs Configuration

Update `api.config.ts` to configure environment-specific base URLs:

```typescript
function getBaseURL(env: string): string {
  switch (env) {
    case 'production':
      return 'https://api.prod.example.com';
    case 'staging':
      return 'https://api.staging.example.com';
    case 'testing':
    default:
      return 'https://api.testing.example.com';
  }
}
```

## Test Execution Details

- **Workers**: 1 (non-parallel execution)
- **Config**: `api.config.ts`
- **Project**: `api`
- **Mode**: Serial execution to avoid race conditions

## Troubleshooting

### Common Issues

1. **Permission denied (Linux/Mac)**
   ```bash
   chmod +x ./run-api-tests-nonparallel.sh
   ```

2. **Unknown option '--env'**
   - Ensure `package.json` script doesn't include `--env` flag
   - Use environment variables instead

3. **Invalid environment**
   - Check `api.config.ts` supports the specified environment
   - Verify base URL configuration

### Debug Mode

To run tests with debug information:

```bash
# Linux/Mac
DEBUG=pw:api ./run-api-tests-nonparallel.sh staging

# Windows
set DEBUG=pw:api && run-api-tests-nonparallel.bat staging
```

## Examples

### Running Tests Against Staging
```bash
# This will:
# 1. Set API_ENV=staging
# 2. Use staging base URL from api.config.ts
# 3. Run tests with single worker
./run-api-tests-nonparallel.sh staging
```

### Expected Output
```
Running API tests in non-parallel mode with a single worker
Environment: staging

> playwright-bankguru-framework@1.0.0 test:api:serial
> playwright test --config=api.config.ts --workers=1 --project=api

Running 15 tests using 1 worker
✓ API tests passed
```

## Best Practices

1. **Use staging for pre-production testing**
2. **Run production tests sparingly** to avoid impacting live systems
3. **Include environment context** in CI/CD pipeline names
4. **Validate environment configuration** before running tests
5. **Use single worker mode** for API tests to prevent race conditions

## Integration with npm Scripts

The scripts utilize the `test:api:serial` npm script defined in `package.json`:

```json
{
  "scripts": {
    "test:api:serial": "playwright test --config=api.config.ts --workers=1 --project=api"
  }
}
```

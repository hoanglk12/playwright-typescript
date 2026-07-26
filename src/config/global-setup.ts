import fs from 'fs';
import { chromium, firefox, webkit, FullConfig, BrowserType } from '@playwright/test';
import { getEnvironment } from './environment';
import type { Environment } from './environment';
import { TestLogger } from '../utils/test-logger';
import { TIMEOUTS } from '../constants/timeouts';
import { redactSensitiveText } from '../utils/redact';

const REQUIRED_ENV_VARS = ['ADMIN_URL', 'FRONTSITE_URL'] as const;
const CONNECTIVITY_RETRY_ATTEMPTS = 3;

async function globalSetup(config: FullConfig) {


  console.log('🚀 Starting Global Setup...\n');
  TestLogger.clearLogs();

  TestLogger.initializeLogging();
  const environment = getEnvironment();
  console.log('📋 Environment configuration:', {
    name: process.env.NODE_ENV || process.env.ENV || 'testing',
    browser: environment.defaultBrowser,
    headless: environment.headless,
    timeout: environment.timeout,
    retries: environment.retries,
    parallelWorkers: environment.parallelWorkers,
  });
  console.log(`🌐 Admin URL: ${environment.adminUrl}`);
  console.log(`🌐 FrontSite URL: ${environment.frontSiteUrl}\n`);

  try {
    await cleanupTestResults();

    await initializeDirectories();

    await validateEnvironment(environment);

    validateRequiredEnvVars();

    await validateBrowsers(config);

    await testConnectivity(environment);

    console.log('\n✅ Global Setup completed successfully!\n');

  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    process.exit(1);
  }
}

async function cleanupTestResults(): Promise<void> {
  console.log('🧹 Cleaning up previous test results...');

  // monocart-report is deliberately excluded — CI's trend-cache step reads
  // monocart-report/index.json from the previous run to render the trend chart
  const resultFolders = [
    'test-results',
    'playwright-report',
    'blob-report',
    '.auth',
    'screenshots',
    'logs',
    'temp',
    'tmp'
  ];
  
  for (const folder of resultFolders) {
    try {
      if (fs.existsSync(folder)) {
        fs.rmSync(folder, { recursive: true, force: true });
        console.log(`   ✅ Removed ${folder}/`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not remove ${folder}/: ${error}`);
    }
  }
}

async function initializeDirectories(): Promise<void> {
  console.log('📁 Initializing directories...');
  
  const directories = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'logs',
    '.auth'
  ];
  
  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   ✅ Created ${dir}/`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not create ${dir}/: ${error}`);
    }
  }
}

async function validateEnvironment(environment: Environment): Promise<void> {
  console.log('🔍 Validating environment configuration...');
  
  const requiredUrls = [
    { name: 'FrontSite', url: environment.frontSiteUrl },
    { name: 'Admin', url: environment.adminUrl }
  ];
  
  for (const { name, url } of requiredUrls) {
    if (!url || url === '') {
      throw new Error(`❌ ${name} URL is not configured in environment`);
    }
    console.log(`   ✅ ${name} URL validated: ${url}`);
  }
  
  if (environment.timeout < 5000) {
    console.warn('   ⚠️ Timeout setting is very low, this may cause test failures');
  }
  
  console.log(`   ✅ Timeout configured: ${environment.timeout}ms`);
  console.log(`   ✅ Retries configured: ${environment.retries}`);
  console.log(`   ✅ Headless mode: ${environment.headless}`);
}

/**
 * Validate that required environment variables were actually set by the loaded .env file,
 * rather than silently falling back to the demo defaults baked into environment.ts
 */
function validateRequiredEnvVars(): void {
  console.log('🔐 Validating required environment variables...');

  const missing = REQUIRED_ENV_VARS.filter(name => !process.env[name] || process.env[name] === '');

  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
  }

  console.log(`   ✅ All required environment variables are set (${REQUIRED_ENV_VARS.join(', ')})`);
}

const BROWSER_LAUNCHERS: Record<string, BrowserType> = { chromium, firefox, webkit };

/**
 * Resolve the browser engine a project actually runs, from its resolved `use` options —
 * device presets (e.g. devices['Desktop Chrome']) set `defaultBrowserType`, not `browserName`
 */
function resolveProjectBrowserName(projectName: string, use: FullConfig['projects'][number]['use']): string | undefined {
  const resolved = use.defaultBrowserType || use.browserName;
  if (resolved && BROWSER_LAUNCHERS[resolved]) {
    return resolved;
  }

  const nameMatch = Object.keys(BROWSER_LAUNCHERS).find(engine => projectName.toLowerCase().includes(engine));
  return nameMatch;
}

/**
 * Validate browser installations, scoped to the engines actually enabled in
 * playwright.config.ts's projects array (e.g. webkit is commented out — do not launch it)
 */
async function validateBrowsers(config: FullConfig): Promise<void> {
  console.log('🌐 Validating browser installations...');

  const enabledEngines = new Set<string>();
  for (const project of config.projects) {
    const engine = resolveProjectBrowserName(project.name, project.use);
    if (engine) {
      enabledEngines.add(engine);
    } else {
      console.warn(`   ⚠️ Could not resolve browser engine for project "${project.name}", skipping validation`);
    }
  }

  for (const engine of enabledEngines) {
    const launcher = BROWSER_LAUNCHERS[engine];
    try {
      const browser = await launcher.launch({ headless: true });
      await browser.close();
      console.log(`   ✅ ${engine} is installed and working`);
    } catch (error) {
      console.warn(`   ⚠️ ${engine} validation failed: ${error}`);
    }
  }
}

/**
 * Test connectivity to target applications. Core app URLs are a hard requirement — retry with
 * backoff to absorb Azure App Service cold starts, then abort the run on final failure.
 */
async function testConnectivity(environment: Environment): Promise<void> {
  console.log('🔗 Testing connectivity to target applications...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const urlsToTest = [
    { name: 'Admin', url: environment.adminUrl },
    { name: 'FrontSite', url: environment.frontSiteUrl }
  ];

  try {
    for (const { name, url } of urlsToTest) {
      let lastError: unknown;

      for (let attempt = 1; attempt <= CONNECTIVITY_RETRY_ATTEMPTS; attempt++) {
        try {
          const response = await page.goto(url, { timeout: TIMEOUTS.PAGE_LOAD });
          if (response && response.ok()) {
            console.log(`   ✅ ${name} application is accessible (${response.status()})`);
            lastError = undefined;
            break;
          }
          lastError = new Error(`returned status ${response?.status()}`);
        } catch (error) {
          lastError = error;
        }

        if (attempt < CONNECTIVITY_RETRY_ATTEMPTS) {
          console.warn(`   ⚠️ ${name} attempt ${attempt}/${CONNECTIVITY_RETRY_ATTEMPTS} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, TIMEOUTS.POLL_INTERVAL_SLOW));
        }
      }

      if (lastError) {
        const envName = process.env.NODE_ENV || process.env.ENV || 'testing';
        throw new Error(
          redactSensitiveText(
            `${name} application unreachable after ${CONNECTIVITY_RETRY_ATTEMPTS} attempts (env: ${envName}, url: ${url}): ${lastError}`
          )
        );
      }
    }
  } finally {
    await browser.close();
  }
}

export default globalSetup;

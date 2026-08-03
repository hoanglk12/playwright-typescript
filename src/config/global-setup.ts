import fs from 'fs';
import { chromium, firefox, webkit, FullConfig, BrowserType } from '@playwright/test';
import { getEnvironment } from './environment';
import type { Environment } from './environment';
import { TestLogger } from '../utils/test-logger';
import { storefronts } from '../data/ecommerce/storefronts';

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
  logBrandUrls();

  try {
    await cleanupTestResults();

    await initializeDirectories();

    await validateEnvironment(environment);

    await validateBrowsers(config);

    console.log('\n✅ Global Setup completed successfully!\n');

  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    process.exit(1);
  }
}

/** Groups the 8 GRA storefronts by brand, pairing each brand's AU/NZ frontsite URLs with its single shared admin URL */
function logBrandUrls(): void {
  console.log('🌐 GRA brand storefronts:');

  const brands = new Map<string, { admin: string; au?: string; nz?: string }>();
  for (const site of storefronts) {
    const entry = brands.get(site.brandName) ?? { admin: site.adminUrl };
    if (site.storeHeader === 'nz') {
      entry.nz = site.url;
    } else {
      entry.au = site.url;
    }
    brands.set(site.brandName, entry);
  }

  for (const [brandName, { admin, au, nz }] of brands) {
    console.log(`   ${brandName}: AU ${au} | NZ ${nz} | Admin ${admin}`);
  }
  console.log('');
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

  if (environment.timeout < 5000) {
    console.warn('   ⚠️ Timeout setting is very low, this may cause test failures');
  }
  
  console.log(`   ✅ Timeout configured: ${environment.timeout}ms`);
  console.log(`   ✅ Retries configured: ${environment.retries}`);
  console.log(`   ✅ Headless mode: ${environment.headless}`);
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

export default globalSetup;

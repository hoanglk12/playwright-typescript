import fs from 'fs';
import path from 'path';
import { chromium, firefox, webkit } from '@playwright/test';
import { getEnvironment } from './environment';
import type { Environment } from './environment';
import { TestLogger } from '../utils/test-logger';

async function globalSetup() {


  console.log('🚀 Starting Global Setup...\n');
  // Clear all logs before starting test execution
  TestLogger.clearLogs();
  
  // Initialize logging session
  TestLogger.initializeLogging();
  // Load environment configuration
  const environment = getEnvironment();
  console.log(`📋 Environment: ${process.env}`);
  console.log(`🌐 Admin URL: ${environment.adminUrl}`);
  console.log(`🌐 FrontSite URL: ${environment.frontSiteUrl}\n`);
  
  try {
    // Step 1: Clean up previous test results
    await cleanupTestResults();
    
    // Step 2: Initialize directories
    await initializeDirectories();
    
    // Step 3: Validate environment
    await validateEnvironment(environment);
    
    // Step 4: Validate browser installations
    await validateBrowsers();
    
    // Step 5: Test connectivity to target applications
    await testConnectivity(environment);
    
    console.log('\n✅ Global Setup completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    process.exit(1);
  }
}

/**
 * Clean up previous test results and artifacts
 */
async function cleanupTestResults(): Promise<void> {
  console.log('🧹 Cleaning up previous test results...');
  
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

/**
 * Initialize required directories
 */
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

/**
 * Validate environment configuration
 */
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
  
  // Validate timeout settings
  if (environment.timeout < 5000) {
    console.warn('   ⚠️ Timeout setting is very low, this may cause test failures');
  }
  
  console.log(`   ✅ Timeout configured: ${environment.timeout}ms`);
  console.log(`   ✅ Retries configured: ${environment.retries}`);
  console.log(`   ✅ Headless mode: ${environment.headless}`);
}

/**
 * Validate browser installations
 */
async function validateBrowsers(): Promise<void> {
  console.log('🌐 Validating browser installations...');
  
  const browsers = [
    { name: 'Chromium', launcher: chromium },
    { name: 'Firefox', launcher: firefox },
    { name: 'WebKit', launcher: webkit }
  ];
  
  for (const { name, launcher } of browsers) {
    try {
      const browser = await launcher.launch({ headless: true });
      await browser.close();
      console.log(`   ✅ ${name} is installed and working`);
    } catch (error) {
      console.warn(`   ⚠️ ${name} validation failed: ${error}`);
    }
  }
}

/**
 * Test connectivity to target applications
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
  
  for (const { name, url } of urlsToTest) {
    try {
      const response = await page.goto(url, { timeout: 15000 });
      if (response && response.ok()) {
        console.log(`   ✅ ${name} application is accessible (${response.status()})`);
      } else {
        console.warn(`   ⚠️ ${name} application returned status: ${response?.status()}`);
      }
    } catch (error) {
      console.warn(`   ⚠️ Could not reach ${name} application: ${error}`);
    }
  }
  
  await browser.close();
}

export default globalSetup;

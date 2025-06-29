/**
 * Environment configuration interface
 * Similar to the Environment interface in the Maven framework
 */
export interface Environment {
  // Application URLs
  frontSiteUrl: string;
  adminUrl: string;
  username: string;
  password: string;
  apiBaseUrl: string;
  
  // Test Configuration
  timeout: number;
  retries: number;
  headless: boolean;
  parallelWorkers: number;
  
  // Browser Configuration
  defaultBrowser: string;
  viewportWidth: number;
  viewportHeight: number;
  
  // Credentials
  adminEmail: string;
  adminPassword: string;
    // Reporting
  reportDir: string;
  htmlReportDir: string;
  screenshotMode: string;
  videoMode: string;
  traceMode: string;
  
  // API Configuration
  apiTimeout: number;
  apiRetries: number;
  
  // Database (if needed)
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Load environment variables from the appropriate .env file
 * @param envName - Environment name (testing, development, staging, production)
 */
function loadEnvironmentFile(envName: string): void {
  const envFile = `.env.${envName}`;
  const envPath = path.resolve(process.cwd(), envFile);
  
  try {
    dotenv.config({ path: envPath });
    console.log(`✅ Loaded environment configuration from: ${envFile}`);
  } catch (error) {
    console.warn(`⚠️  Could not load ${envFile}, falling back to default .env`);
    dotenv.config(); // Load default .env file
  }
}

/**
 * Get environment configuration from loaded environment variables
 */
function getEnvironmentFromEnvVars(): Environment {
  return {
    // Application URLs
    adminUrl: process.env.ADMIN_URL || 'http://demo.guru99.com/V4/',
    frontSiteUrl: process.env.FRONTSITE_URL || 'https://demo.nopcommerce.com/',
    username: process.env.USER_NAME || 'testuser',
    password: process.env.PASSWORD || 'testpassword',
    apiBaseUrl: process.env.API_BASE_URL || 'https://api-demo.guru99.com',
      // Test Configuration
    timeout: parseInt(process.env.TIMEOUT || '30000'),
    retries: parseInt(process.env.RETRIES || '2'),
    headless: process.env.HEADLESS === 'true',
    parallelWorkers: (() => {
      // Check if WORKERS environment variable is set
      if (process.env.WORKERS) {
        // If set to 50%, use half of available CPU cores (minimum 1)
        if (process.env.WORKERS === '50%') {
          return Math.max(Math.floor(require('os').cpus().length / 2), 1);
        }
        // If set to a number, parse it
        const workersNum = parseInt(process.env.WORKERS);
        if (!isNaN(workersNum) && workersNum > 0) {
          return workersNum;
        }
      }
      
      // Fallback to PARALLEL_WORKERS or default to 4
      return parseInt(process.env.PARALLEL_WORKERS || '4');
    })(),
    
    // Browser Configuration
    defaultBrowser: process.env.DEFAULT_BROWSER || 'chromium',
    viewportWidth: parseInt(process.env.VIEWPORT_WIDTH || '1920'),
    viewportHeight: parseInt(process.env.VIEWPORT_HEIGHT || '1080'),
    
    // Credentials
    adminEmail: process.env.ADMIN_EMAIL || 'admin@yourstore.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
      // Reporting
    reportDir: process.env.REPORT_DIR || 'test-results',
    htmlReportDir: process.env.HTML_REPORT_DIR || 'playwright-report',
    screenshotMode: process.env.SCREENSHOT_MODE || 'only-on-failure',
    videoMode: process.env.VIDEO_MODE || 'retain-on-failure',
    traceMode: process.env.TRACE_MODE || 'on-first-retry',
    
    // API Configuration
    apiTimeout: parseInt(process.env.API_TIMEOUT || '15000'),
    apiRetries: parseInt(process.env.API_RETRIES || '3'),
    
    // Database Configuration
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || '5432'),
    dbName: process.env.DB_NAME || 'test_db',
    dbUser: process.env.DB_USER || 'test_user',
    dbPassword: process.env.DB_PASSWORD || 'test_password',
  };
}

/**
 * Environment configurations for different testing environments
 * These are now loaded from .env files
 */
export const environments: Record<string, Environment> = {};

/**
 * Get environment configuration based on NODE_ENV or ENV environment variable
 */
export function getEnvironment(): Environment {
  const envName = process.env.NODE_ENV || process.env.ENV || 'testing';
  
  // Load the appropriate .env file
  loadEnvironmentFile(envName);
  
  // Get configuration from environment variables
  const env = getEnvironmentFromEnvVars();
  
  console.log(`🌍 Using environment: ${envName}`);
  console.log(`🔗 CMS URL: ${env.adminUrl}`);
  console.log(`⚙️  Parallel Workers: ${env.parallelWorkers}`);
  console.log(`⚙️  Timeout: ${env.timeout}ms`);
  console.log(`⚙️  Retries: ${env.retries}`);
  console.log(`🖥️  Headless: ${env.headless}`);
  
  return env;
}
import dotenv from 'dotenv';
import fs from 'fs';

/**
 * API-specific environment configurations
 * This helps keep API tests isolated from UI tests
 */
export interface ApiEnvironment {
  apiBaseUrl: string;
  restfulApiBaseUrl: string;
  graphqlBaseUrl: string;
  graphqlEndpoint: string;
  timeout: number;
  retries: number;
}

/**
 * Load environment configurations for API testing only
 */
export function getApiEnvironment(): ApiEnvironment {
  // Load environment variables based on NODE_ENV
  const env = process.env.NODE_ENV || 'testing';
  const envPath = `.env.${env}`;
  
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  
  // Fallback to default .env file if exists
  if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
  }
  
  // Detect CI environment
  const isCI = process.env.CI === 'true' || 
               process.env.GITLAB_CI === 'true' || 
               process.env.TF_BUILD === 'True' || // Azure DevOps
               process.env.GITHUB_ACTIONS === 'true';
  
  return {
    apiBaseUrl: process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com',
    restfulApiBaseUrl: process.env.RESTFUL_API_BASE_URL || 'https://api.restful-api.dev',
    graphqlBaseUrl: process.env.GRAPHQL_BASE_URL || 'https://stag-platypus-au.accentgra.com',
    graphqlEndpoint: process.env.GRAPHQL_ENDPOINT || '/graphql',
    timeout: parseInt(process.env.API_TIMEOUT || (isCI ? '60000' : '30000')),
    retries: parseInt(process.env.API_RETRIES || (isCI ? '2' : '0')),
  };
}
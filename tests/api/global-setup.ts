import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting API test global setup...');
  console.log(`API Base URL: ${process.env.API_BASE_URL || 'https://restful-booker.herokuapp.com'}`);
  console.log('Mode: Sequential (fullyParallel:false) — failures do not skip subsequent tests');
  console.log('Browser: None (pure API testing)');
  
  console.log('✅ API test global setup completed');
}

export default globalSetup;
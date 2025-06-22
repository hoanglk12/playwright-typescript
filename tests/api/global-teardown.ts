import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting API test global teardown...');
  
  // API-specific cleanup
  // - Clean up test data
  // - Reset API state if needed
  
  console.log('✅ API test global teardown completed');
}

export default globalTeardown;
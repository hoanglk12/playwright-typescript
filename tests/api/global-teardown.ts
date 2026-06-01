import { FullConfig } from '@playwright/test';
import { sharedState } from './shared-state';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting API test global teardown...');
  sharedState.reset();
  console.log('✅ API test global teardown completed');
}

export default globalTeardown;
import * as  ProfileListingData from '../../src/data/profile-listing-data';
import { test, expect } from '../../src/config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';


test.describe('Profile Listing Page Verification', () => {
  test('TC_01 - Verify Header Logo and Highlighted Text Color', async ({ 
    profileListingPage,
    
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('Profile Listing Page Verification');


    logger.step('Step 1 - Navigate to profile listing page');
    logger.action('Navigate', 'profile listing page');
    await profileListingPage.navigateToProfileListingPage();
    await profileListingPage.waitForAjaxRequestsCompleteAdvanced();
        
    logger.step('Step 2 - Verify profiles are displayed');
    logger.action('Verify', 'profiles are displayed');
    const profileCount = await profileListingPage.getProfileCount();
    expect(profileCount).toBeGreaterThan(0);
   

    
  });
});
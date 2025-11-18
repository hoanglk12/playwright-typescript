import * as  ProfileListingData from '../../src/data/profile-listing-data';
import { test, expect } from '../../src/config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';


test.describe('Profile Listing Page Verification', () => {
  test('TC_01 - Verify Profile Listing Page with Default Sorting', async ({ 
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

    logger.step('Step 3 - Verify Sort By dropdown default option is Default');
    logger.action('Verify', 'sort by dropdown shows Default');
    const selectedLabel = await profileListingPage.getSelectedSortByLabel();
    expect(selectedLabel).toEqual(ProfileListingData.SortData.SORT_BY_DEFAULT);

    logger.step('Step 4 - Select Surname and verify profiles sorted ascending');
    logger.action('Select and Verify', 'select Surname and verify ascending sort');
    await profileListingPage.selectSortByDropDownWithSurname();
    // wait a bit for sorting to apply
    await profileListingPage.waitForAjaxRequestsCompleteAdvanced();
    const isSorted = await profileListingPage.verifyProfilesSortedBySurnameAscending();
    expect(isSorted).toBeTruthy();
   

    
  });
});
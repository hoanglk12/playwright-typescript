import * as  ProfileListingData from '../../src/data/profile-listing-data';
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';


test.describe('Profile Listing Page Verification', () => {
  test('TC_01 - Verify Profile Listing Page with Default Sorting', async ({
    profileListingPage,
    softAssert,
  }) => {
    //Declare logger for test steps
    const logger = createTestLogger('Profile Listing Page Verification');


    logger.step('Step 1 - Navigate to profile listing page');
    logger.action('Navigate', 'profile listing page');
    await profileListingPage.navigateToProfileListingPage();
    await profileListingPage.waitForAjaxRequestsComplete();

    logger.step('Step 2 - Verify profiles are displayed');
    const profileCount = await profileListingPage.getProfileCount();
    softAssert.toBeGreaterThan(profileCount, 0, 'Profile count > 0');

    logger.step('Step 3 - Verify Sort By dropdown default option is Default');
    const selectedLabel = await profileListingPage.getSelectedSortByLabel();
    softAssert.toEqual(selectedLabel, ProfileListingData.SortData.SORT_BY_DEFAULT, 'Sort by default label');

    logger.step('Step 4 - Select Surname and verify profiles sorted ascending');
    logger.action('Select and Verify', 'select Surname and verify ascending sort');
    await profileListingPage.selectSortByDropDownWithSurname();
    // wait a bit for sorting to apply
    await profileListingPage.waitForAjaxRequestsComplete();
    // expect.poll retries until sort settles after AJAX update — avoids one-shot race
    await expect.poll(() => profileListingPage.verifyProfilesSortedBySurnameAscending(), { timeout: 20000 }).toBeTruthy();
   

    
  });
});
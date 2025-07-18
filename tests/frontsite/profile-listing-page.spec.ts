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
    await profileListingPage.waitForAjaxRequestsComplete();
        
    logger.step('Step 2 - Select sort by dropdown with surname');
    logger.action('Select', 'sort by dropdown with surname');
    await profileListingPage.selectSortByDropDownWithSurname();

    logger.step('Step 3 - Verify default of surname sorting is Ascending');
    logger.action('Verify', 'default of surname sorting is Ascending');
    const tooltipText = await profileListingPage.getTooltipTextFromSortButton();
    expect.soft(tooltipText).toEqual(ProfileListingData.SortData.SORT_BY_SURNAME.SURNAME_ASC);
   

    
  });
});
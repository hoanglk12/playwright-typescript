import { test, expect } from '../../src/config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';

/**
 * Insights Page Tests
 * @feature Insights Search
 * @story Insights Search Functionality
 */

// test.describe('Insights Page Search @insights @frontsite', () => {
  //Declare logger for test steps
  const logger = createTestLogger('Insights Search Scenarios');

  test('Search for Banking content', async ({
    insightsPage,
  }) => {

    logger.step('Step 1 - Navigate to Insights page');
    logger.action('Navigate', 'insights page');
    await insightsPage.navigateToInsightsPage();

    logger.step('Step 2 - Type "Banking" in search textbox');
    logger.action('Type', '"Banking" in search textbox');
    await insightsPage.typeInSearchInput('Banking');

    logger.step('Step 3 - Verify search results contain "Banking"');
    logger.action('Verify', 'search results contain "Banking"');
    const containsBanking = await insightsPage.verifySearchResultsContainText('Banking');
    expect(containsBanking).toBeTruthy();
  });
// });
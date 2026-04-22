import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';

/**
 * Insights Page Tests
 * @feature Insights Search
 * @story Insights Search Functionality
 */
test.describe('Insights Page Search @insights @frontsite', () => {
  test('Search for Banking content', async ({
    insightsPage,
  }) => {
    // Logger is scoped to this test to avoid shared mutable state between tests
    const logger = createTestLogger('Insights Search Scenarios');

    logger.step('Step 1 - Navigate to Insights page');
    logger.action('Navigate', 'insights page');
    await insightsPage.navigateToInsightsPage();

    logger.step('Step 2 - Type "Banking" in search textbox');
    logger.action('Type', '"Banking" in search textbox');
    await insightsPage.typeInSearchInput('Banking');

    logger.step('Step 3 - Verify search results contain "Banking"');
    logger.action('Verify', 'search results contain "Banking"');
    // toContainText retries until results load — avoids one-shot boolean on slow QA server
    await expect(insightsPage.resultsContainer).toContainText('Banking', { timeout: 20000 });
  });
});
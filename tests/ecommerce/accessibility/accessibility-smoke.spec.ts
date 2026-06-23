import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import { createTestLogger } from '@utils/test-logger';

test.describe('Ecommerce Accessibility Smoke @ecommerce @smoke @a11y', () => {
  test.slow();

  for (const site of storefronts) {
    test(`E2E-A11Y-001 - ${site.name} homepage has no critical or serious WCAG 2.1 AA violations`, async ({ ecommerceHomePage, makeAxeBuilder }) => {
      const logger = createTestLogger(`${site.name} - Accessibility`);

      logger.step('Step 1 - Navigate to homepage');
      await ecommerceHomePage.navigate(site.url);

      logger.step('Step 2 - Run axe WCAG 2.1 AA scan');
      const results = await makeAxeBuilder()
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      logger.step('Step 3 - Attach full violation list to report');
      const criticalOrSerious = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );
      if (results.violations.length > 0) {
        test.info().annotations.push({
          type: 'a11y-violations',
          description: JSON.stringify(
            results.violations.map(v => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              nodes: v.nodes.length,
            })),
            null,
            2
          ),
        });
      }
      logger.verify('Critical/serious WCAG violations', 0, criticalOrSerious.length);

      logger.step('Step 4 - Assert no critical or serious violations');
      expect(
        criticalOrSerious,
        `Critical/serious WCAG violations on ${site.name}:\n` +
          criticalOrSerious.map(v => `  [${v.impact}] ${v.id}: ${v.description}`).join('\n')
      ).toHaveLength(0);
    });
  }
});

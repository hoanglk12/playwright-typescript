import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class EcommerceHomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'commit' });
    await expect(this.page.getByRole('main')).toBeVisible({ timeout: 90_000 });
    // Stop remaining resource loads so Firefox context teardown doesn't hang
    await this.page.evaluate(() => window.stop()).catch(() => {});
  }

  async assertTitleMatches(regex: RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(regex, { timeout: 15_000 });
  }

  async assertMainContentVisible(): Promise<void> {
    await expect(this.page.getByRole('main')).toBeVisible();
  }

  async assertHeroVisible(): Promise<void> {
    await expect(this.page.getByRole('main').getByRole('img').first()).toBeVisible();
  }

  async assertPromoMessageVisible(siteName: string, promoRegex: RegExp): Promise<void> {
    await expect
      .poll(
        async () => {
          return this.page.evaluate(() => {
            const headerText = (document.querySelector('header')?.textContent || '').trim();
            const bodyText = (document.body?.innerText || '').trim();
            return `${headerText}\n${bodyText.slice(0, 8000)}`;
          });
        },
        {
          message: `Expected promotional text on ${siteName}`,
          timeout: 30_000,
          intervals: [500, 1000, 2000],
        }
      )
      .toMatch(promoRegex);
  }
}
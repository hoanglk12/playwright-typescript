import { expect, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceHomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(url: string): Promise<void> {
    // 'commit' fires as soon as the server starts sending the document —
    // far faster than 'load'/'domcontentloaded' on SPAs that have dozens of
    // 3rd-party analytics/tracking scripts (FullStory, TikTok, Insider, Adobe,
    // BazaarVoice, etc.) that can delay those events by 2+ minutes on Firefox.
    // Do NOT call waitForAjaxRequestsCompleteAdvanced() — continuous analytics
    // and GraphQL XHRs on these SPAs keep pendingRequests non-empty forever.
    await this.page.goto(url, { waitUntil: 'commit' });
    // Wait for React to hydrate and render the main content area
    await this.page.locator('main').waitFor({ state: 'visible' });
  }

  async assertTitleMatches(regex: RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(regex, { timeout: TIMEOUTS.PAGE_LOAD_SLOW });
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
          try {
            return await this.page.evaluate(() => {
              const headerText = (document.querySelector('header')?.textContent || '').trim();
              // Use textContent instead of innerText — innerText triggers layout reflow
              // and returns empty string in Firefox when the layout engine is busy/deferred.
              const bodyText = (document.body?.textContent || '').trim();
              return `${headerText}\n${bodyText.slice(0, 8000)}`;
            });
          } catch {
            // Navigation may destroy the execution context; return empty to let poll retry
            return '';
          }
        },
        {
          message: `Expected promotional text on ${siteName}`,
          timeout: 60_000,
          intervals: [500, 1000, 2000],
        }
      )
      .toMatch(promoRegex);
  }
}

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

  async assertPromoMessageVisible(siteName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          try {
            return await this.page.evaluate(() => {
              const selectors = [
                '[class*="top-header"]',
                '[class*="announcement"]',
                '[class*="promo"]',
                '[class*="notice"]',
                '[class*="message"]',
                '[class*="cmsBlock-root"]',
                '[class*="cmsBlock-content"]',
              ];

              const isVisiblePromo = (element: Element | null): boolean => {
                if (!(element instanceof HTMLElement)) return false;

                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();

                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  rect.width > 120 &&
                  rect.height > 12 &&
                  rect.top < 220 &&
                  rect.bottom > 0 &&
                  text.length >= 12
                );
              };

              for (const selector of selectors) {
                if (Array.from(document.querySelectorAll(selector)).some((element) => isVisiblePromo(element))) {
                  return true;
                }
              }

              return Array.from(document.querySelectorAll('body *')).some((element) => {
                if (!(element instanceof HTMLElement)) return false;
                if (element.matches('body, main, nav, header, footer')) return false;
                if (element.closest('nav')) return false;

                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();

                return (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  rect.width > 120 &&
                  rect.height > 12 &&
                  rect.top >= 0 &&
                  rect.top < 220 &&
                  rect.bottom > 0 &&
                  text.length >= 12
                );
              });
            });
          } catch {
            return false;
          }
        },
        {
          message: `Expected promotional banner to be displayed on ${siteName}`,
          timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          intervals: [500, 1000, 2000],
        }
      )
      .toBe(true);
  }
}

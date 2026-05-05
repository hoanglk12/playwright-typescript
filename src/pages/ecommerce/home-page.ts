import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceHomePage extends BasePage {
  private readonly mainElement: Locator;
  private readonly mainRegion: Locator;
  private readonly heroImage: Locator;
  private readonly topHeaderSelector = '.top-header-desktop';
  private readonly promoBannerSelectors: readonly string[] = [
    '[class*="top-header"]',
    '[class*="announcement"]',
    '[class*="promo"]',
    '[class*="notice"]',
    '[class*="message"]',
    '[class*="cmsBlock-root"]',
    '[class*="cmsBlock-content"]',
  ];

  constructor(page: Page) {
    super(page);
    this.mainElement = page.locator('main');
    this.mainRegion = page.getByRole('main');
    this.heroImage = this.mainRegion.getByRole('img').first();
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
    await this.mainElement.waitFor({ state: 'visible' });
  }

  async assertTitleMatches(regex: RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(regex, { timeout: TIMEOUTS.PAGE_LOAD_SLOW });
  }

  async assertMainContentVisible(): Promise<void> {
    await expect(this.mainRegion).toBeVisible();
  }

  async assertHeroVisible(): Promise<void> {
    await expect(this.heroImage).toBeVisible();
  }

  /**
   * E2E-HOME-003 — AU sites only.
   *
   * The top bar (.top-header-desktop) on AU storefronts contains an anchor link
   * "Earn 2 Qantas Points per $1 spent*". We poll until the bar has hydrated
   * (React may not have rendered it yet when <main> first appears) and then
   * assert the Qantas text is present.
   */
  async assertQantasPointsVisible(siteName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          try {
            return await this.page.evaluate((selector) => {
              const topBar = document.querySelector(selector);
              if (!topBar) return null; // bar not in DOM yet — keep polling
              const text = (topBar instanceof HTMLElement ? topBar.innerText : topBar.textContent ?? '').toLowerCase();
              return text.includes('qantas');
            }, this.topHeaderSelector);
          } catch {
            return null;
          }
        },
        {
          message: `Expected Qantas Points link to be visible in top bar on AU site: ${siteName}`,
          timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          intervals: [500, 1000, 2000],
        }
      )
      .toBe(true);
  }

  /**
   * E2E-HOME-003 — NZ sites only.
   *
   * The top bar on NZ storefronts does NOT contain Qantas text at all (the word
   * does not appear in the DOM). We first wait for the bar to render
   * (confirmed by the "shipping" text that is present on every site), then
   * assert that "qantas" is absent from its inner text.
   */
  async assertQantasPointsAbsent(siteName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          try {
            return await this.page.evaluate((selector) => {
              const topBar = document.querySelector(selector);
              if (!topBar) return null; // bar not in DOM yet — keep polling
              const text = (topBar instanceof HTMLElement ? topBar.innerText : topBar.textContent ?? '').toLowerCase();
              // Guard: only conclude once the bar's own content has hydrated.
              // Different sites use different wording: Platypus/Skechers say "shipping",
              // Vans says "delivery". Accept either to avoid a permanent null on Vans NZ.
              if (!text.includes('shipping') && !text.includes('delivery')) return null;
              return !text.includes('qantas');
            }, this.topHeaderSelector);
          } catch {
            return null;
          }
        },
        {
          message: `Expected Qantas Points to be absent from top bar on NZ site: ${siteName}`,
          timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          intervals: [500, 1000, 2000],
        }
      )
      .toBe(true);
  }

  async assertPromoMessageVisible(siteName: string): Promise<void> {
    await expect
      .poll(
        async () => {
          try {
            return await this.page.evaluate((selectors) => {
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
            }, [...this.promoBannerSelectors]);
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

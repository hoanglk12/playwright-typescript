import { PageRef } from './page-ref';
import { ElementHelper } from './element-helper';
import { TIMEOUTS } from '../../constants/timeouts';

const DEFAULT_COOKIE_SELECTORS: string[] = [
  '[id*="cookie"] button[class*="accept"]',
  '[class*="cookie"] button[class*="accept"]',
  'button[id*="accept-all"]',
  'button[id*="accept_all"]',
  '#onetrust-accept-btn-handler',
  '.cc-btn.cc-allow',
  '[data-testid*="cookie"] button',
  'button:has-text("Accept All")',
  'button:has-text("Accept Cookies")',
  'button:has-text("I Accept")',
];

const DEFAULT_CLOSE_SELECTORS: string[] = [
  '[aria-label="Close"]',
  '[aria-label="close"]',
  'button.close',
  '.modal-close',
  '[class*="popup"] [class*="close"]',
  '[class*="overlay"] [class*="close"]',
  '#popup-close',
  '[data-dismiss="modal"]',
];

/**
 * Detects and dismisses common overlay patterns (cookie banners, popups, modals).
 * All methods are safe — they do not throw if nothing is matched.
 */
export class OverlayHelper {
  constructor(
    private readonly pageRef: PageRef,
    private readonly elements: ElementHelper,
  ) {}

  async dismissCookieBanner(): Promise<boolean> {
    for (const selector of DEFAULT_COOKIE_SELECTORS) {
      try {
        const el = this.pageRef.current.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout: TIMEOUTS.DIALOG_APPEAR });
        await this.elements.clickElement(selector);
        return true;
      } catch {
        // not visible within the wait window — try next selector
      }
    }
    return false;
  }

  async dismissPopup(closeSelectors?: string[]): Promise<boolean> {
    const selectors = closeSelectors ?? DEFAULT_CLOSE_SELECTORS;
    for (const selector of selectors) {
      try {
        const el = this.pageRef.current.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout: TIMEOUTS.DIALOG_APPEAR });
        await this.elements.clickElement(selector);
        return true;
      } catch {
        // not visible within the wait window — try next selector
      }
    }
    return false;
  }

  /** Waits for ALL provided selectors to disappear, not just the first. */
  async waitForOverlayGone(overlaySelectors: string[], timeout?: number): Promise<void> {
    const t = timeout ?? TIMEOUTS.ELEMENT_VISIBLE;
    for (const selector of overlaySelectors) {
      try {
        await this.pageRef.current.waitForSelector(selector, { state: 'hidden', timeout: t });
      } catch {
        // best effort — if overlay was never present, continue
      }
    }
  }

  async isAnyOverlayVisible(overlaySelectors: string[]): Promise<boolean> {
    for (const selector of overlaySelectors) {
      try {
        const el = this.pageRef.current.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout: TIMEOUTS.DIALOG_APPEAR });
        return true;
      } catch {
        // not visible
      }
    }
    return false;
  }

  async dismissAll(): Promise<boolean> {
    const cookieDismissed = await this.dismissCookieBanner();
    const popupDismissed = await this.dismissPopup();
    return cookieDismissed || popupDismissed;
  }
}

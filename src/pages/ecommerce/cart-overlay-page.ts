import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceCartOverlayPage extends BasePage {
  // All DOM queries use page.evaluate() because styled-component hashed class names are
  // unreliable across builds. The cart icon is identified by semantic href/aria-label
  // attributes (per getMiniCartCount() pattern on pdp-page.ts). The overlay detector uses
  // modal-role semantics and fixed/absolute positioning + actionable CTA to distinguish an
  // open mini cart panel from the persistent header cart icon (always in DOM).

  constructor(page: Page) {
    super(page);
  }

  // Finds and clicks the first visible cart icon. Matches cart anchors by href pattern
  // and aria-label (consistent across all 8 storefronts, per getMiniCartCount() pattern).
  async clickCartIcon(): Promise<void> {
    await this.page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('a[href*="/cart"], [aria-label*="cart" i], [aria-label*="bag" i]'),
      );
      for (const el of candidates) {
        const r = (el as Element).getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          (el as HTMLElement).click();
          return;
        }
      }
    });
  }

  // Detects a visible mini cart overlay panel — NOT the persistent header cart icon.
  // Requires all three: (1) modal/overlay role or class semantics — includes aside/
  // complementary because Platypus AU renders the mini cart as an aside panel, (2) fixed/
  // absolute CSS positioning (overlay panels overlay content; persistent header chrome is
  // relative/sticky), and (3) an actionable cart CTA ("checkout", "view cart/bag", "proceed").
  // This prevents false-positives from always-present header cart elements.
  async isOverlayVisible(): Promise<boolean> {
    return this.page.evaluate(() => {
      const panels = Array.from(
        document.querySelectorAll(
          '[role="dialog"], [aria-modal="true"], aside, [role="complementary"], [class*="drawer"], [class*="overlay"], [class*="minicart"], [class*="mini-cart"]',
        ),
      );
      return panels.some((el) => {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(el as Element);
        const isOverlayPositioned = style.position === 'fixed' || style.position === 'absolute';
        const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
        const hasCartCta = /checkout|view (cart|bag)|proceed|go to (cart|bag)/.test(text);
        return isOverlayPositioned && (text.includes('cart') || text.includes('bag')) && hasCartCta;
      });
    });
  }

  // Polls isOverlayVisible() until the mini cart overlay becomes visible.
  // Wrapped in .catch(() => {}) — best-effort, same convention as other polling
  // methods in this suite. The caller's softAssert is the source of truth for failures.
  async waitForOverlayVisible(): Promise<void> {
    await this.waits
      .waitForCustomCondition(async () => this.isOverlayVisible(), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
        interval: TIMEOUTS.POLL_INTERVAL_FAST,
      })
      .catch(() => {});
  }
}

import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommerceCartOverlayPage extends BasePage {
  // All DOM queries use page.evaluate() because styled-component hashed class names are
  // unreliable across builds. The cart icon is identified by semantic href/aria-label
  // attributes (per getMiniCartCount() pattern on pdp-page.ts). The overlay detector uses
  // modal-role semantics and fixed/absolute positioning + actionable CTA to distinguish an
  // open mini cart panel from the persistent header cart icon (always in DOM).

  // Shared selector for all overlay panel detection methods. Includes aside/complementary
  // because Platypus AU renders the mini cart as an aside panel, not a dialog.
  private readonly overlayPanelSelector =
    '[role="dialog"], [aria-modal="true"], aside, [role="complementary"], [class*="drawer"], [class*="overlay"], [class*="minicart"], [class*="mini-cart"]';

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
    const sel = this.overlayPanelSelector;
    return this.page.evaluate((selector) => {
      const panels = Array.from(document.querySelectorAll(selector));
      return panels.some((el) => {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(el as Element);
        const isOverlayPositioned = style.position === 'fixed' || style.position === 'absolute';
        const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
        const hasCartCta = /checkout|view (cart|bag)|proceed|go to (cart|bag)/.test(text);
        return isOverlayPositioned && (text.includes('cart') || text.includes('bag')) && hasCartCta;
      });
    }, sel);
  }

  // Checks whether any visible mini cart overlay panel contains the given text (case-insensitive).
  // Uses a two-part gate (position:fixed/absolute + "cart"/"bag" presence) without the checkout-CTA
  // requirement used by isOverlayVisible(). The CTA gate is intentionally dropped here because on
  // some storefronts the product-line-items panel and the checkout-CTA footer are sibling elements
  // at the same selector level — the product panel would fail the CTA test even when the overlay is
  // fully open. The caller has already confirmed the overlay is open via isOverlayVisible() before
  // calling this method.
  async overlayContainsText(text: string): Promise<boolean> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate(
      ({ selector, searchText }) => {
        const panels = Array.from(document.querySelectorAll(selector));
        return panels.some((el) => {
          const r = (el as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const style = getComputedStyle(el as Element);
          if (style.position !== 'fixed' && style.position !== 'absolute') return false;
          const elText = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
          if (!elText.includes('cart') && !elText.includes('bag')) return false;
          return elText.includes(searchText);
        });
      },
      { selector: sel, searchText: text.toLowerCase() },
    );
  }

  // Checks whether any visible mini cart overlay panel contains the given size label as a
  // whole token on a non-price line. `overlayContainsText` can false-positive on short
  // numeric sizes (e.g. "4") that appear inside price strings like "$149.99". This method
  // mitigates that by (a) splitting the panel innerText into lines, (b) filtering out any
  // line containing "$" (price lines), and (c) matching the size value as a whole token
  // using a word-boundary equivalent — not part of a longer digit sequence.
  async overlayContainsSizeLabel(size: string): Promise<boolean> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate(
      ({ selector, sizeValue }) => {
        const panels = Array.from(document.querySelectorAll(selector));
        return panels.some((el) => {
          const r = (el as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          const style = getComputedStyle(el as Element);
          if (style.position !== 'fixed' && style.position !== 'absolute') return false;
          const elText = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
          if (!elText.includes('cart') && !elText.includes('bag')) return false;
          const escaped = sizeValue.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tokenPattern = new RegExp(`(^|[^\\w])${escaped}([^\\w]|$)`);
          return elText
            .split(/\r?\n/)
            .filter((line) => !line.includes('$'))
            .some((line) => tokenPattern.test(line.trim()));
        });
      },
      { selector: sel, sizeValue: size },
    );
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

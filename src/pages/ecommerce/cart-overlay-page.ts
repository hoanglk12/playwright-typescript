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

  // Clicks the first remove control inside the visible mini cart overlay panel.
  // Uses a two-pass strategy to avoid clicking a header close "×" before the line-item remove:
  //   Pass 1 (preferred): button with aria-label matching /remove|delete/ — excludes close/dismiss.
  //   Pass 2 (fallback): button whose visible text matches /^(remove|delete)$/ (symbol-only glyphs
  //   are intentionally excluded here; bare × can be a header close button on many storefronts).
  // Scoped to the same visible positioned overlay panel detected by isOverlayVisible(). Throws in
  // TS-land (not inside evaluate) to give the healer a clean error on unsupported storefronts.
  async removeFirstItem(): Promise<void> {
    const sel = this.overlayPanelSelector;
    const clicked = await this.page.evaluate((panelSelector) => {
      const visiblePanels = Array.from(document.querySelectorAll(panelSelector)).filter((panel) => {
        const r = (panel as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(panel as Element);
        return style.position === 'fixed' || style.position === 'absolute';
      });

      if (visiblePanels.length === 0) return false;

      for (const panel of visiblePanels) {
        const buttons = Array.from(panel.querySelectorAll('button, a[role="button"], a'));

        // Pass 1: aria-label matches "remove" or "delete" but NOT "close" or "dismiss".
        // This is the most reliable discriminator across styled-component storefronts.
        for (const btn of buttons) {
          const br = (btn as Element).getBoundingClientRect();
          if (br.width === 0 || br.height === 0) continue;
          const ariaLabel = (btn.getAttribute('aria-label') ?? '').toLowerCase();
          if (/remove|delete/.test(ariaLabel) && !/close|dismiss/.test(ariaLabel)) {
            (btn as HTMLElement).click();
            return true;
          }
        }

        // Pass 2: visible text exactly matches "remove" or "delete" (word form only, not symbol
        // glyphs — × and ✕ are skipped because they are ambiguous with header close buttons).
        for (const btn of buttons) {
          const br = (btn as Element).getBoundingClientRect();
          if (br.width === 0 || br.height === 0) continue;
          const ariaLabel = (btn.getAttribute('aria-label') ?? '').toLowerCase();
          if (/close|dismiss/.test(ariaLabel)) continue;
          const text = ((btn as HTMLElement).innerText ?? btn.textContent ?? '').trim().toLowerCase();
          if (/^(remove|delete)$/.test(text)) {
            (btn as HTMLElement).click();
            return true;
          }
        }
      }

      return false;
    }, sel);

    if (!clicked) {
      throw new Error(
        'removeFirstItem: no remove control found inside the visible mini cart overlay. ' +
          'Neither aria-label*="remove|delete" (pass 1) nor text="remove|delete" (pass 2) ' +
          'matched any visible button within the positioned overlay panel.',
      );
    }
  }

  // Reads the numeric cart count from the header cart icon — identical evaluate body to
  // getMiniCartCount() on EcommercePDPPage. Duplicated here so that waitForMiniCartCountDecrement
  // can poll independently without a cross-page-object dependency. The header cart link is the
  // correct source: some storefronts auto-close the mini cart when it empties, so reading from
  // the overlay would fail after removal.
  private async getCartCountFromDOM(): Promise<number> {
    const text = await this.page.evaluate(() => {
      const cartLinks = Array.from(
        document.querySelectorAll('a[href*="/cart"], [aria-label*="cart" i], [aria-label*="bag" i]'),
      );
      for (const link of cartLinks) {
        const r = (link as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        // Path 1: parse count from aria-label — updates with React state on Vans/Platypus storefronts
        // Pattern: "You have 1 item in your cart" / "You have 2 items in your cart"
        const ariaLabel = link.getAttribute('aria-label') ?? '';
        const ariaMatch = ariaLabel.match(/\byou have (\d+) items?\b/i);
        if (ariaMatch && parseInt(ariaMatch[1], 10) > 0) return ariaMatch[1];
        // Path 2: numeric leaf node added to the button subtree after ATC
        const descendants = [link, ...Array.from(link.querySelectorAll('*'))];
        for (const el of descendants) {
          if ((el as Element).children.length > 0) continue;
          const t = el.textContent?.trim() ?? '';
          if (/^\d+$/.test(t)) return t;
        }
      }
      return '0';
    });
    return parseInt(text, 10) || 0;
  }

  // Polls until the cart badge count drops below previousCount (i.e. a remove completed)
  // or until NETWORK_IDLE_SLOW times out. Mirrors waitForMiniCartCountIncrement() on
  // EcommercePDPPage. Wrapped in .catch(() => {}) — best-effort; the hard expect() in the
  // spec is the source of truth for test failure.
  async waitForMiniCartCountDecrement(previousCount: number): Promise<number> {
    let currentCount = previousCount;
    await this.waits
      .waitForCustomCondition(
        async () => {
          currentCount = await this.getCartCountFromDOM();
          return currentCount < previousCount;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return currentCount;
  }
}

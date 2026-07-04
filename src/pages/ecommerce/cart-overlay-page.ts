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

  // Strict variant of isOverlayVisible() that additionally requires non-zero opacity and
  // visibility on the matched panel. Confirmed via live investigation of GRA/Magento PWA
  // Studio storefronts: the mini cart drawer's outer panel is permanently mounted in the DOM
  // at position:fixed with a full-viewport bounding box, and open/close is implemented purely
  // via `opacity: 0 <-> 1` — the layout box and position never change between states, and
  // crucially, `innerText` still reads through an opacity:0 element. This means
  // isOverlayVisible()'s position + rect + CTA gate is true whether the drawer is open OR
  // closed, making it unsuitable for detecting the CLOSED state. isOverlayVisible() itself is
  // intentionally left unchanged — CART-003/004/005/008 already depend on its existing
  // semantics for detecting the overlay opening. This method is used only by the Continue
  // Shopping close-overlay flow (E2E-CART-006), where distinguishing "mounted but hidden"
  // from "genuinely open" is required.
  async isOverlayGenuinelyOpen(): Promise<boolean> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate((selector) => {
      const panels = Array.from(document.querySelectorAll(selector));
      return panels.some((el) => {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(el as Element);
        const isOverlayPositioned = style.position === 'fixed' || style.position === 'absolute';
        if (!isOverlayPositioned) return false;
        if (parseFloat(style.opacity) === 0 || style.visibility === 'hidden') return false;
        const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
        const hasCartCta = /checkout|view (cart|bag)|proceed|go to (cart|bag)/.test(text);
        return (text.includes('cart') || text.includes('bag')) && hasCartCta;
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

  // Returns the subtotal amount from the visible mini cart overlay as a formatted price string
  // (e.g. "$49.99" or "AUD$49.99"). The subtotal is the unit price × quantity before tax/shipping —
  // for a single item with no shipping applied, it equals the unit price on the PDP.
  //
  // Label search is tiered (three staged passes across all visible elements in the overlay panel)
  // to return the subtotal row, not the grand total:
  //   Pass 1 — label text matches /subtotal/i (most specific: only the subtotal row)
  //   Pass 2 — label text matches /order\s+total/i (order total before tax on some storefronts)
  //   Pass 3 — label text matches /^total/i (fallback: "Total" heading, not a price-only line)
  //
  // A label element is the deepest element whose own textContent matches the label regex AND
  // whose own textContent does NOT itself contain a price — this anchors extraction to the label
  // cell rather than a parent container whose textContent merges label + price. Price extraction
  // from that label element then tries: (1) label's own text for an embedded price, (2) next
  // sibling's text, (3) parent's text — returning the first /[A-Z]{0,3}\$[\d,]+\.\d{2}/ match.
  //
  // Returns '' (empty string) if no subtotal row is found — never throws.
  async getCartTotal(): Promise<string> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate((panelSelector) => {
      const priceRe = /[A-Z]{0,3}\$[\d,]+\.\d{2}/;

      // Collect ALL positioned (fixed/absolute) panels containing "cart" or "bag" text.
      // Using filter + iteration (not .find) so that if a broad selector like `aside` or
      // `[role="complementary"]` matches an earlier non-cart element, we still reach the
      // actual mini cart panel. Mirrors removeFirstItem's multi-panel pattern.
      const panels = Array.from(document.querySelectorAll(panelSelector)).filter((el) => {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(el as Element);
        if (style.position !== 'fixed' && style.position !== 'absolute') return false;
        const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').toLowerCase();
        return text.includes('cart') || text.includes('bag');
      });

      if (panels.length === 0) return '';

      // Returns the visible text of any Element, preferring innerText for HTMLElements
      // (which collapses whitespace and honours CSS display:none) and falling back to
      // textContent for SVG and other non-HTML elements.
      const getText = (el: Element): string =>
        (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();

      /**
       * Within `panel`, walk every element to find the deepest element whose own text matches
       * `labelRe`. "Deepest" means: none of its direct children ALSO matches `labelRe` —
       * this descends through broad ancestors (e.g. a totals-section container) until we
       * reach the tightest element that carries the label text.
       *
       * The child check is label-only (NOT gated on the child containing a price). This is
       * intentional: on Skechers AU, the tightest label element (e1008) has innerText
       * "Subtotal 1 Item $219.99" — its children e1009 ("1 Item") and e1010 ("$219.99") do NOT
       * match /subtotal/i, so e1008 is correctly identified as the deepest label element and
       * its own text is used for price extraction. Adding a price guard here would incorrectly
       * skip elements whose children carry a price alongside the label.
       *
       * From the label element, price extraction tries:
       *   1. The label element's own text (subtotal row as a single element)
       *   2. The next sibling's text (label cell | price cell layout)
       *   3. The parent's text (row container whose innerText merges label + price)
       * Returns the first /[A-Z]{0,3}\$[\d,]+\.\d{2}/ match or '' if none found.
       */
      const extractPriceNearInPanel = (panel: Element, labelRe: RegExp): string => {
        const allEls = Array.from(panel.querySelectorAll('*'));
        for (const el of allEls) {
          const ownText = getText(el);
          // Must match the label pattern and must not be a short pure-price string
          // (avoids treating a "$49.99" price element as the label).
          if (!labelRe.test(ownText)) continue;
          if (priceRe.test(ownText) && ownText.length < 20) continue;

          // Require deepest label match: descend until no child also matches labelRe.
          // The price guard is intentionally absent — a child carrying a price AND the label
          // text is still a "match", which would promote us to descend further. We only stop
          // descending when NO child matches the label (price-only or other-text children).
          const childMatchesLabel = Array.from(el.children).some((child) =>
            labelRe.test(getText(child)),
          );
          if (childMatchesLabel) continue;

          // Extraction pass 1: label element's own text (inline label+price)
          const ownMatch = ownText.match(priceRe);
          if (ownMatch) return ownMatch[0];

          // Extraction pass 2: next sibling (label cell | price cell layout)
          const nextSibling = el.nextElementSibling;
          if (nextSibling) {
            const sibMatch = getText(nextSibling).match(priceRe);
            if (sibMatch) return sibMatch[0];
          }

          // Extraction pass 3: parent row container (merges label + price in innerText)
          const parent = el.parentElement;
          if (parent) {
            const parentMatch = getText(parent).match(priceRe);
            if (parentMatch) return parentMatch[0];
          }
        }
        return '';
      };

      // Tiered label search across all matching panels. Stop as soon as any tier + panel
      // returns a non-empty price. Tier order: Subtotal → Order Total → Total (generic).
      const labelTiers: RegExp[] = [/subtotal/i, /order\s+total/i, /^total/i];
      for (const labelRe of labelTiers) {
        for (const panel of panels) {
          const price = extractPriceNearInPanel(panel, labelRe);
          if (price) return price;
        }
      }
      return '';
    }, sel);
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

  // Clicks the "Continue Shopping" control inside the visible mini cart overlay panel, if
  // present. Scoped to the same visible positioned overlay panel detected by isOverlayVisible()
  // (fixed/absolute + non-zero bounding box), mirroring removeFirstItem's panel-scan pattern.
  // Matches button/link elements whose visible text OR aria-label matches /continue shopping/i.
  // Returns false (never throws) when no matching control is found — this control's presence
  // varies per storefront and callers must treat "not found" as a valid skip condition.
  async clickContinueShopping(): Promise<boolean> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate((panelSelector) => {
      const visiblePanels = Array.from(document.querySelectorAll(panelSelector)).filter((panel) => {
        const r = (panel as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(panel as Element);
        return style.position === 'fixed' || style.position === 'absolute';
      });

      if (visiblePanels.length === 0) return false;

      const continueShoppingRe = /continue shopping/i;

      for (const panel of visiblePanels) {
        const controls = Array.from(panel.querySelectorAll('button, a[role="button"], a'));
        for (const control of controls) {
          const r = (control as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const ariaLabel = control.getAttribute('aria-label') ?? '';
          const text = ((control as HTMLElement).innerText ?? control.textContent ?? '').trim();
          if (continueShoppingRe.test(ariaLabel) || continueShoppingRe.test(text)) {
            (control as HTMLElement).click();
            return true;
          }
        }
      }

      return false;
    }, sel);
  }

  // Polls isOverlayGenuinelyOpen() until the mini cart overlay becomes genuinely open (non-zero
  // opacity, visible). Needed because ensureCartOverlayOpen() (smoke-helpers.ts) only waits on
  // the loose isOverlayVisible() detector, which is satisfied the instant the permanently-mounted
  // drawer panel has a non-zero fixed-position bounding box — this can be true BEFORE the CSS
  // opacity fade-in transition has completed (or even started, if the panel auto-opens without an
  // explicit click). A caller that immediately reads isOverlayGenuinelyOpen() right after
  // ensureCartOverlayOpen() can therefore catch the panel mid-transition (opacity still 0 or
  // partial) and read false, even though the overlay is about to be genuinely open a moment
  // later. This showed up as a concurrency-sensitive flake (3/8 storefronts failing at 3 workers,
  // 0/8 at 1 worker) on the Continue Shopping precondition check. Wrapped in .catch(() => {}) —
  // best-effort, same convention as other polling methods in this suite. The caller's
  // softAssert/expect remains the source of truth for failures.
  async waitForOverlayGenuinelyOpen(): Promise<void> {
    await this.waits
      .waitForCustomCondition(async () => this.isOverlayGenuinelyOpen(), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
        interval: TIMEOUTS.POLL_INTERVAL_FAST,
      })
      .catch(() => {});
  }

  // Polls isOverlayGenuinelyOpen() until the mini cart overlay becomes hidden. Uses the strict
  // (opacity-aware) detector rather than isOverlayVisible() — see isOverlayGenuinelyOpen()'s
  // docblock for why the loose detector can never report "closed" on GRA storefronts. Wrapped
  // in .catch(() => {}) — best-effort, same convention as other polling methods in this suite.
  // The caller's softAssert is the source of truth for failures.
  async waitForOverlayHidden(): Promise<void> {
    await this.waits
      .waitForCustomCondition(async () => !(await this.isOverlayGenuinelyOpen()), {
        timeout: TIMEOUTS.ELEMENT_VISIBLE,
        interval: TIMEOUTS.POLL_INTERVAL_FAST,
      })
      .catch(() => {});
  }

  // Closes the mini cart overlay if it is (or becomes) genuinely open — best-effort, never throws.
  // WHY: addToCart() (pdp-page.ts) uses only click({ force: true }) with no elementFromPoint/
  // dispatchEvent coverage fallback (unlike selectSize()). If a storefront auto-opens the
  // position:fixed mini cart drawer after the first Add to Cart, that drawer can sit on top of
  // the PDP's size selector/ATC button and swallow the second add's click. Callers performing
  // two sequential Add to Cart actions on the same PDP (e.g. E2E-CART-007) must call this
  // between the two adds to guarantee the overlay is not intercepting clicks.
  //
  // Confirmed via live investigation (Platypus AU): the drawer does NOT open synchronously with
  // the ATC click — it was still closed ~immediately after the click, and only became genuinely
  // open ~2s later (opacity fade-in completes after the cart-add API round trip). A single
  // isOverlayGenuinelyOpen() check taken right after waitForMiniCartCountIncrement() therefore
  // races the drawer's delayed open and can see "closed" a moment before it opens — this method
  // must actively poll for a possible late open, not just sample the state once.
  //
  // Strategy: poll isOverlayGenuinelyOpen() for up to ELEMENT_CLICKABLE — if it never opens,
  // return (no-op, the common case on storefronts that don't auto-open). If it opens, try
  // clickContinueShopping() (returns false harmlessly if no such control exists), fall back to
  // Escape, then wait for it to close.
  async closeOverlayIfOpen(): Promise<void> {
    try {
      const becameOpen = await this.waits
        .waitForCustomCondition(async () => this.isOverlayGenuinelyOpen(), {
          timeout: TIMEOUTS.ELEMENT_CLICKABLE,
          interval: TIMEOUTS.POLL_INTERVAL_FAST,
        })
        .then(() => true)
        .catch(() => false);
      if (!becameOpen) return;
      const closed = await this.clickContinueShopping();
      if (!closed) {
        await this.page.keyboard.press('Escape');
      }
      await this.waitForOverlayHidden();
    } catch {
      // best-effort — caller's downstream soft assertions are the source of truth
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

  // Returns the empty-cart message text from either:
  //   (a) a visible positioned (fixed/absolute) panel containing "cart" or "bag" text — no
  //       checkout CTA requirement because empty state has no checkout button, or
  //   (b) the page body — covers storefronts that navigate to /cart page when cart icon is clicked.
  // Regex deliberately tolerates filler words ("currently", "now") between "cart/bag" and "empty".
  // Returns the matched message string (e.g. "Your Shopping Cart is empty") or '' if not found.
  // Never throws.
  async getEmptyCartMessage(): Promise<string> {
    const sel = this.overlayPanelSelector;
    return this.page.evaluate((selector) => {
      const emptyRe =
        /your (shopping )?(cart|bag) is (currently |now )?empty|(cart|bag) is (currently |now )?empty|no items in (your )?(cart|bag)/i;

      // Check overlay panels first — no CTA requirement (empty state has no checkout button)
      const panels = Array.from(document.querySelectorAll(selector));
      for (const el of panels) {
        const r = (el as Element).getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const style = getComputedStyle(el as Element);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;
        const text = el instanceof HTMLElement ? el.innerText : (el.textContent ?? '');
        const lower = text.toLowerCase();
        if (!lower.includes('cart') && !lower.includes('bag')) continue;
        const match = text.match(emptyRe);
        if (match) return match[0];
      }

      // Fallback: page body — covers storefronts that navigate to /cart on empty-cart icon click
      // document.body is always HTMLBodyElement (subtype of HTMLElement), so innerText is always available.
      const bodyText = document.body.innerText ?? document.body.textContent ?? '';
      const bodyMatch = bodyText.match(emptyRe);
      if (bodyMatch) return bodyMatch[0];

      return '';
    }, sel);
  }
}

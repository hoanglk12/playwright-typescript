import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

export class EcommercePDPPage extends BasePage {
  private readonly productNameHeading = this.page.getByRole('heading', { level: 1 }).first();
  // Storefronts use styled-components with hashed class names — CSS class selectors are
  // unreliable across builds. Match by price text pattern ($X.XX or $X,XXX.XX) on leaf nodes.
  private readonly priceTextPattern = '^\\$[\\d,]+(\\.[\\d]{2})?$';
  private readonly galleryImageSelector =
    '[class*="gallery"] img, .product-gallery img, .swiper-slide img, img[class*="product"], img[alt*="product"]';
  private readonly PDP_URL_PATTERN = /(\/product\/|\/p\/|\/pdp\/|\.html)/i;
  // Colour swatches: .swiper-slide <a> links inside the container that owns the colorScroller controls.
  // :has() targets the swiper-container that directly contains a colorScroller-next button.
  private readonly colorScrollerContainerSelector =
    '[class*="swiper-container"]:has([class*="colorScroller-next"])';
  private readonly acquisitionPopupSelector = '[class*="bloomreach-acquisition-popup"][class*="state-open"]';
  // Vans post-ATC Bloomreach popup (#popup.popup.visible, z-index 200) — a DIFFERENT popup
  // from acquisitionPopupSelector's swatch overlay. It appears after add-to-cart and
  // intercepts the cart icon click.
  private readonly postAtcPopupCloseSelector = '#popup-close';
  // getByRole uses accessible name; storefronts render aria-label="Justify" on ATC buttons,
  // which overrides the visible text and breaks getByRole matching. Match by text content instead.
  private readonly addToCartBtnLocator = this.page.locator('button', { hasText: /add to (cart|bag)/i });
  private readonly sizePatternSource = '^(US\\s+|UK\\s+|EU\\s+)?\\d+(\\.\\d+)?$';
  private readonly genderPatternSource =
    '\\b(mens?|womens?|male|female|us\\s+mens?|us\\s+womens?|uk\\s+mens?|uk\\s+womens?)\\b';
  // [role="alert"] and [aria-live] are the preferred signals. Storefronts that don't use ARIA
  // (e.g. Platypus "Size was not chosen" in a plain div) are caught by sizeValidationTextPattern.
  private readonly sizeValidationSelector =
    '[role="alert"], [aria-live]:not([aria-live="off"])';
  // Matches validation text that implies a size was not selected. Does NOT match "CHOOSE SIZE"
  // (no error word follows) or numeric size labels. Uses two alternatives:
  //   1. "size" then an error word within 50 chars
  //   2. a request word then "size" within 30 chars (e.g. "Please select a size")
  private readonly sizeValidationTextPattern =
    '\\bsize\\b[^.!?]{0,50}\\b(not|error|required|invalid|missing|must)\\b' +
    '|\\b(please|must|need|require)\\b[^.!?]{0,30}\\bsize\\b';

  private bloomreachHandlerRegistered = false;

  constructor(page: Page) {
    super(page);
  }

  // WHY: Vans AU Bloomreach popup re-appears on a timer after every interaction; addLocatorHandler
  // fires before any action so the DOM removal is permanent without manual per-method dismiss calls.
  private async setupBloomreachHandler(): Promise<void> {
    if (this.bloomreachHandlerRegistered) return;
    this.bloomreachHandlerRegistered = true;
    await this.page.addLocatorHandler(
      this.page.locator(this.acquisitionPopupSelector),
      async () => {
        await this.page.evaluate(() => {
          document
            .querySelectorAll('[class*="bloomreach-acquisition-popup"]')
            .forEach((el) => el.remove());
        });
      },
    );
  }

  async waitForPdpLoad(): Promise<void> {
    await this.setupBloomreachHandler();
    await this.waits.waitForUrlMatches(this.PDP_URL_PATTERN, TIMEOUTS.PAGE_LOAD_SLOW);
    await this.productNameHeading.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD });
  }

  async getProductName(): Promise<string> {
    return (await this.productNameHeading.textContent())?.trim() ?? '';
  }

  async getPrice(): Promise<string> {
    const pattern = this.priceTextPattern;
    let result = '';
    await this.waits.waitForCustomCondition(
      async () => {
        result = await this.page.evaluate((pat) => {
          const re = new RegExp(pat);
          const all = Array.from(document.querySelectorAll('*'));
          for (const el of all) {
            const text = el.textContent?.trim() ?? '';
            if ((el as Element).children.length === 0 && re.test(text)) return text;
          }
          return '';
        }, pattern);
        return result.length > 0;
      },
      { timeout: TIMEOUTS.ELEMENT_VISIBLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
    ).catch(() => {});
    return result;
  }

  async isImageGalleryVisible(): Promise<boolean> {
    const selector = this.galleryImageSelector;
    return this.page.evaluate((sel) => {
      const imgs = Array.from(document.querySelectorAll(sel));
      return imgs.some((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, selector);
  }

  async getColourSwatchCount(): Promise<number> {
    return this.elements
      .locator(this.colorScrollerContainerSelector)
      .locator('.swiper-slide')
      .count();
  }

  private async dismissAcquisitionPopup(): Promise<void> {
    try {
      const popup = this.elements.locator(this.acquisitionPopupSelector);
      if ((await popup.count()) === 0) return;
      const closeBtn = popup.getByRole('button').first();
      const btnVisible = await closeBtn
        .waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_CLICKABLE })
        .then(() => true)
        .catch(() => false);
      if (btnVisible) {
        await closeBtn.click({ force: true });
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.waits
        .waitForCustomCondition(async () => (await popup.count()) === 0, {
          timeout: TIMEOUTS.DIALOG_DISMISS,
          interval: TIMEOUTS.POLL_INTERVAL_FAST,
        })
        .catch(() => {});
    } catch {
      // best-effort dismissal
    }
  }

  // Dismisses the Vans post-ATC Bloomreach popup if it appears (see
  // postAtcPopupCloseSelector). Best-effort and session-based — the popup does not always
  // appear, so callers should gate this to Vans storefronts to avoid paying the
  // DIALOG_APPEAR wait on storefronts where the selector never matches.
  async dismissPostAtcPopup(): Promise<void> {
    const closeBtn = this.elements.locator(this.postAtcPopupCloseSelector);
    const appeared = await closeBtn
      .waitFor({ state: 'visible', timeout: TIMEOUTS.DIALOG_APPEAR })
      .then(() => true)
      .catch(() => false);
    if (appeared) {
      await closeBtn.click({ force: true }).catch(() => {});
    }
  }

  async clickColourSwatch(index: number): Promise<void> {
    await this.dismissAcquisitionPopup();
    const currentUrl = this.page.url();
    const slides = this.elements
      .locator(this.colorScrollerContainerSelector)
      .locator('.swiper-slide');
    const count = await slides.count();
    let alternativeIndex = 0;
    for (let i = 0; i < count; i++) {
      const slide = slides.nth(i);
      const href = await slide.locator('a').getAttribute('href');
      const absolute = href ? new URL(href, currentUrl).toString() : '';
      if (absolute !== currentUrl) {
        if (alternativeIndex === index) {
          // WHY: React-router SPA; goto() triggers client routing that waits.waitForURL() cannot drive
          await this.page.goto(absolute, {
            waitUntil: 'domcontentloaded',
            timeout: TIMEOUTS.PAGE_LOAD_SLOW,
          });
          return;
        }
        alternativeIndex++;
      }
    }
    throw new Error(`clickColourSwatch: no alternative swatch found at index ${index}`);
  }

  async waitForVariantNavigation(previousUrl: string): Promise<void> {
    await this.waits.waitForUrlPredicate(
      (url) => url !== previousUrl,
      TIMEOUTS.PAGE_LOAD_SLOW,
    );
    await this.waitForPdpLoad();
    const selector = this.galleryImageSelector;
    // WHY: no WaitHelper equivalent for arbitrary JS polling
    await this.page
      .waitForFunction(
        (sel) => {
          const imgs = Array.from(document.querySelectorAll(sel));
          return imgs.some((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
        },
        selector,
        { timeout: TIMEOUTS.ELEMENT_VISIBLE },
      )
      .catch(() => {
        // best-effort — gallery selector may not match all storefront DOM structures;
        // the explicit isImageGalleryVisible() soft assertion in the spec reports the real state
      });
  }

  async getFirstGalleryImageSrc(): Promise<string> {
    const selector = this.galleryImageSelector;
    return this.page.evaluate((sel) => {
      const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
      const visible = imgs.find((img) => {
        const r = img.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return visible?.src ?? '';
    }, selector);
  }

  async waitForGalleryImageChange(previousSrc: string): Promise<void> {
    if (!previousSrc) return;
    const selector = this.galleryImageSelector;
    // WHY: no WaitHelper equivalent for arbitrary JS polling
    await this.page.waitForFunction(
      ({ sel, prev }) => {
        const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
        const visible = imgs.find((img) => {
          const r = img.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        return visible?.src !== undefined && visible.src !== prev;
      },
      { sel: selector, prev: previousSrc },
      { timeout: TIMEOUTS.ELEMENT_VISIBLE },
    );
  }

  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: TIMEOUTS.PAGE_LOAD_SLOW });
  }

  async ensureNoOverlay(): Promise<void> {
    await this.dismissAcquisitionPopup();
  }

  async isSizeSelectorVisible(): Promise<boolean> {
    return this.page.evaluate((sizePatSrc) => {
      // Storefronts use styled-components — class names are hashed and don't contain "size".
      // Detect the size selector by checking for visible buttons with numeric size labels,
      // or as a fallback, a visible leaf node containing the word "SIZE".
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasSizeButtons = buttons.some((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (hasSizeButtons) return true;
      const allLeaves = Array.from(document.querySelectorAll('*'));
      return allLeaves.some((el) => {
        if ((el as Element).children.length > 0) return false;
        const text = el.textContent?.trim() ?? '';
        if (!/\bSIZE\b/i.test(text)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, this.sizePatternSource);
  }

  async getSizeGenderToggleLabels(): Promise<string[]> {
    return this.page.evaluate(({ sizePatSrc, genderPatSrc }) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const genderPattern = new RegExp(genderPatSrc, 'i');

      // Anchor search to the size section: find a visible size-like button, then
      // walk up the DOM to find a common ancestor that also contains gender toggles.
      // This prevents matching header nav links named "WOMENS"/"MENS" which would
      // navigate away from the PDP when clicked.
      const allButtons = Array.from(document.querySelectorAll('button'));
      const sizeButtons = allButtons.filter((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (sizeButtons.length === 0) return [];

      let container: Element | null = sizeButtons[0].parentElement;
      while (container && container !== document.body) {
        const genderBtns = Array.from(container.querySelectorAll('button')).filter((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!text || !genderPattern.test(text) || sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (genderBtns.length > 0) {
          return [...new Set(genderBtns.map((btn) => btn.textContent?.trim() ?? ''))];
        }
        // Stop at the product form — breadcrumbs and nav live outside it as siblings
        if (container.tagName === 'FORM') break;
        container = container.parentElement;
      }
      return [];
    }, { sizePatSrc: this.sizePatternSource, genderPatSrc: this.genderPatternSource });
  }

  async clickSizeGenderToggle(label: string): Promise<void> {
    await this.dismissAcquisitionPopup();
    // DOM-proximity click: locate target button within the same ancestor that contains
    // size buttons. Avoids clicking header nav elements also named "WOMENS"/"MENS".
    const clicked = await this.page.evaluate(
      ({ lbl, sizePatSrc }) => {
        const sizePattern = new RegExp(sizePatSrc, 'i');
        const targetPattern = new RegExp(
          `\\b${lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        );
        const allButtons = Array.from(document.querySelectorAll('button'));
        const sizeButtons = allButtons.filter((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (sizeButtons.length === 0) return false;
        let container: Element | null = sizeButtons[0].parentElement;
        while (container && container !== document.body) {
          const match = Array.from(container.querySelectorAll('button')).find((btn) => {
            const text = btn.textContent?.trim() ?? '';
            if (!targetPattern.test(text)) return false;
            const r = btn.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          if (match) {
            (match as HTMLButtonElement).click();
            return true;
          }
          // Stop at the product form — breadcrumbs and nav live outside it as siblings
          if (container.tagName === 'FORM') break;
          container = container.parentElement;
        }
        return false;
      },
      { lbl: label, sizePatSrc: this.sizePatternSource },
    );
    if (!clicked) {
      throw new Error(`clickSizeGenderToggle: button "${label}" not found near size selector`);
    }
    // Poll for the size grid to update after toggle; best-effort — some storefronts only
    // render sizes after colour selection, so a timeout here is expected and acceptable.
    await this.waits
      .waitForCustomCondition(
        async () => (await this.getVisibleSizeLabels()).length > 0,
        { timeout: TIMEOUTS.ELEMENT_CLICKABLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
  }

  async getAvailableSizes(): Promise<string[]> {
    return this.page.evaluate((sizePatSrc) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const results: string[] = [];
      for (const btn of buttons) {
        const btnEl = btn as HTMLButtonElement;
        if (btnEl.disabled) continue;
        if (btnEl.getAttribute('aria-hidden') === 'true') continue;
        const text = btnEl.textContent?.trim() ?? '';
        if (!text || !sizePattern.test(text)) continue;
        const r = btnEl.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        results.push(text);
      }
      return results;
    }, this.sizePatternSource);
  }

  async getVisibleSizeLabels(): Promise<string[]> {
    return this.page.evaluate((sizePatSrc) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const buttons = Array.from(document.querySelectorAll('button'));
      const results: string[] = [];
      for (const btn of buttons) {
        if (btn.getAttribute('aria-hidden') === 'true') continue;
        const text = btn.textContent?.trim() ?? '';
        if (!text || !sizePattern.test(text)) continue;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        results.push(text);
      }
      return results;
    }, this.sizePatternSource);
  }

  async selectSize(label: string): Promise<void> {
    await this.dismissAcquisitionPopup();
    // Escape special regex chars in the label so "3.5" matches exactly "3.5", not "305".
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use Playwright's locator click (not page.evaluate) so React synthetic events fire properly.
    // page.evaluate HTMLButtonElement.click() bypasses React's event delegation and does not
    // update state reliably on storefronts where ATC is disabled until a size is selected.
    const sizeBtn = this.page
      .locator('button')
      .filter({ hasText: new RegExp(`^${escaped}$`) })
      .first();
    // WHY: on DM NZ at 1920×1080, the L3L4Navigation-root container (z-index:100,
    // pointer-events:auto) stays in the DOM at the size button's viewport coordinates even
    // after the megamenu visually closes. force:true dispatches at element centre coordinates
    // — if another element is topmost at those coords, the click goes there and React never
    // registers the size selection. Use elementFromPoint to detect coverage; if covered,
    // dispatchEvent bypasses coordinate-based dispatch entirely and fires directly on the
    // button DOM element where it bubbles to React's root event listener.
    const isSizeBtnTopmost = await sizeBtn
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      })
      .catch(() => true);
    if (!isSizeBtnTopmost) {
      await sizeBtn.evaluate((el: HTMLElement) => {
        el.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, view: window }),
        );
      });
    } else {
      // force: true bypasses sticky-header/overlay hit-test check on second+ size attempts.
      await sizeBtn.click({ timeout: TIMEOUTS.ELEMENT_CLICKABLE, force: true });
    }
  }

  async isAddToCartEnabled(): Promise<boolean> {
    // WHY: storefronts like DM NZ make an async stock-check AJAX call (~300-500ms) after size
    // selection and change the ATC button text (Add to Cart → Notify Me) asynchronously. Without
    // a stability wait, this method returns true in the brief pre-AJAX window for sold-out sizes,
    // causing addToCart() to fire against a sold-out product that the server silently rejects.
    // Poll until the ATC button count is the same on two consecutive reads before declaring state.
    let prevCount = -1;
    let stableCount = 0;
    await this.waits
      .waitForCustomCondition(
        async () => {
          const count = await this.addToCartBtnLocator.count();
          if (count === prevCount) {
            stableCount = count;
            return true;
          }
          prevCount = count;
          return false;
        },
        { timeout: TIMEOUTS.ELEMENT_CLICKABLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {
        stableCount = prevCount >= 0 ? prevCount : 0;
      });
    if (stableCount === 0) return false;
    try {
      return !(await this.addToCartBtnLocator.first().isDisabled({ timeout: TIMEOUTS.ELEMENT_VISIBLE }));
    } catch {
      return false;
    }
  }

  // Polls until at least one numeric size button is visible and enabled, then returns.
  // Best-effort: silently resolves after ELEMENT_CLICKABLE timeout so the caller's
  // skip guard (availableSizes.length === 0) still fires for non-footwear products.
  async waitForSizeButtonsToRender(): Promise<void> {
    await this.waits
      .waitForCustomCondition(
        async () => (await this.getAvailableSizes()).length > 0,
        { timeout: TIMEOUTS.ELEMENT_VISIBLE, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
  }

  async addToCart(): Promise<void> {
    const buttons = this.addToCartBtnLocator;
    await buttons.first().waitFor({ state: 'attached', timeout: TIMEOUTS.ELEMENT_VISIBLE }).catch(() => {});
    const count = await buttons.count();
    if (count === 0) {
      throw new Error('addToCart: no Add to Cart / Add to Bag button found in DOM');
    }
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        // force: true bypasses sticky-header/overlay interception while still firing React
        // synthetic events — same pattern as selectSize().
        await btn.click({ timeout: TIMEOUTS.ELEMENT_VISIBLE, force: true });
        return;
      }
    }
    await buttons.first().click({ timeout: TIMEOUTS.ELEMENT_VISIBLE, force: true });
  }

  async hasSizeValidationMessage(): Promise<boolean> {
    const ariaSelector = this.sizeValidationSelector;
    const textPattern = this.sizeValidationTextPattern;
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(
            ({ ariasel, textpat }: { ariasel: string; textpat: string }) => {
              const isVisibleWithText = (el: Element): boolean => {
                const text = el.textContent?.trim() ?? '';
                if (!text) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              };
              // 1. ARIA-based signals (preferred — semantic and hash-safe)
              if (Array.from(document.querySelectorAll(ariasel)).some(isVisibleWithText)) return true;
              // 2. Plain-text validation messages (storefronts that omit ARIA on validation divs,
              //    e.g. Platypus "Size was not chosen" in a generic element with no role/aria-live).
              //    Pre-filter to leaf nodes containing "size" before applying the full regex
              //    to avoid scanning thousands of DOM nodes on every poll iteration.
              const re = new RegExp(textpat, 'i');
              return Array.from(document.querySelectorAll('*')).some((el) => {
                if ((el as Element).children.length > 0) return false;
                const text = el.textContent?.trim() ?? '';
                if (!text || !/size/i.test(text)) return false;
                return isVisibleWithText(el) && re.test(text);
              });
            },
            { ariasel: ariaSelector, textpat: textPattern },
          );
          return found;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return found;
  }

  // Reads the numeric badge adjacent to the cart icon. Anchors on semantic cart links
  // (aria-label or href) to avoid class-hashed selectors, which are unreliable on these storefronts.
  // Two read paths tried in order per candidate element:
  //   1. aria-label text "You have N item(s)" — updates with React state, may precede DOM badge render
  //   2. numeric leaf-node text — the visible badge span added to the button subtree after ATC
  // CAVEAT: returns 0 when neither path finds a count (icon-only state at 0 items is expected).
  // For E2E-PDP-006 this is a secondary signal only — the primary check is hasSizeValidationMessage().
  async getMiniCartCount(): Promise<number> {
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

  async getSizeToggleActiveLabel(): Promise<string> {
    return this.page.evaluate(({ sizePatSrc, genderPatSrc }) => {
      const sizePattern = new RegExp(sizePatSrc, 'i');
      const genderPattern = new RegExp(genderPatSrc, 'i');
      const allButtons = Array.from(document.querySelectorAll('button'));
      const sizeButtons = allButtons.filter((btn) => {
        const text = btn.textContent?.trim() ?? '';
        if (!sizePattern.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (sizeButtons.length === 0) return '';
      // Walk up from size buttons to find the gender toggle in the same container
      let container: Element | null = sizeButtons[0].parentElement;
      while (container && container !== document.body) {
        const activeBtn = Array.from(container.querySelectorAll('button')).find((btn) => {
          const text = btn.textContent?.trim() ?? '';
          if (!text || !genderPattern.test(text) || sizePattern.test(text)) return false;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          return (
            btn.getAttribute('aria-selected') === 'true' ||
            btn.getAttribute('aria-pressed') === 'true' ||
            btn.getAttribute('aria-current') === 'true' ||
            btn.classList
              .toString()
              .toLowerCase()
              .split(/\s+/)
              .some((c) => c.includes('active') || c.includes('selected') || c.includes('current'))
          );
        });
        if (activeBtn) return activeBtn.textContent?.trim() ?? '';
        container = container.parentElement;
      }
      return '';
    }, { sizePatSrc: this.sizePatternSource, genderPatSrc: this.genderPatternSource });
  }

  async waitForMiniCartCountIncrement(previousCount: number): Promise<number> {
    let currentCount = previousCount;
    await this.waits
      .waitForCustomCondition(
        async () => {
          currentCount = await this.getMiniCartCount();
          return currentCount > previousCount;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return currentCount;
  }
}

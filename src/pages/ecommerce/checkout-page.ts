import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';

// RECON FINDINGS (Platypus AU staging, 2026-06-30):
//
// Question A — Can a guest reach the checkout form?
//   Clicking the CHECKOUT button in the mini-cart ASIDE overlay does NOT navigate to /checkout.
//   Instead it renders an auth modal ON the same PDP page (URL unchanged). The modal contains:
//     - A login section: email + password fields + "LOG IN & CONTINUE" button
//     - A guest section: email field + "CONTINUE AS GUEST" button
//   Clicking "CONTINUE AS GUEST" without filling the guest email triggers validation.
//   Guest checkout is available; no login required to enter the checkout flow.
//
// Question B — What does blank-field validation look like?
//   Clicking "CONTINUE AS GUEST" without filling the guest email shows plain-text:
//     "Please enter your email address."
//   This element has no [role="alert"] or [aria-live] — it is detected via text pattern scan.
//   Pattern used: /(please enter|is required|required|please select|must be|invalid)/i
//
// Checkout URL pattern: the auth modal renders on the PDP page (no URL change).
//   waitForCheckoutLoad() detects the auth modal state (CONTINUE AS GUEST button visible).
//   isOnCheckoutPage() returns true when the auth modal OR a /checkout URL is active.

export class EcommerceCheckoutPage extends BasePage {
  // Overlay panel selector — same as EcommerceCartOverlayPage.overlayPanelSelector.
  // Includes aside/complementary because Platypus AU renders the mini cart as an ASIDE panel.
  private readonly overlayPanelSelector =
    '[role="dialog"], [aria-modal="true"], aside, [role="complementary"], [class*="drawer"], [class*="overlay"], [class*="minicart"], [class*="mini-cart"]';

  // Checkout URL pattern for storefronts that navigate to a dedicated /checkout page
  // (e.g. when the user is already logged in and the auth modal is bypassed).
  private readonly checkoutUrlPattern = /\/checkout/i;

  // Text pattern that identifies the checkout CTA inside the mini-cart overlay.
  // Matches: "CHECKOUT", "Proceed to Checkout", "View Bag", "Go to Bag".
  private readonly checkoutCtaTextPattern =
    /proceed to checkout|^checkout$|go to (cart|bag)|view (cart|bag)/i;

  // Text pattern that identifies the guest submit button at the auth modal step.
  // Matches: "CONTINUE AS GUEST", "Guest Checkout", "Continue as Guest".
  private readonly guestSubmitPattern = /guest/i;

  // Text pattern that identifies the primary submit button on any checkout step
  // (shipping address form, payment step, order review).
  private readonly checkoutSubmitPattern =
    /continue|next|place order|review order|proceed|submit|go to payment/i;

  // Validation error text pattern — covers both:
  //   a) Auth modal step: "Please enter your email address."
  //   b) Shipping form step: "This is a required field.", "Please enter a value."
  private readonly validationTextPattern =
    /(please enter|please provide|please select|is required|required field|must be|cannot be blank|invalid|this field)/i;

  // ARIA selector for semantic validation signals (preferred over text scan).
  private readonly ariaValidationSelector = '[role="alert"], [aria-live]:not([aria-live="off"])';

  constructor(page: Page) {
    super(page);
  }

  // Detects whether the checkout auth modal is visible.
  // The modal appears on the same page (URL unchanged) after clicking CHECKOUT in the overlay.
  // Identified by the presence of visible "CONTINUE AS GUEST" or "LOG IN & CONTINUE" buttons.
  private async isAuthModalVisible(): Promise<boolean> {
    return this.page.evaluate((guestPattern: string) => {
      const re = new RegExp(guestPattern, 'i');
      const btns = Array.from(
        document.querySelectorAll('button, input[type="submit"]'),
      ) as HTMLButtonElement[];
      return btns.some((btn) => {
        const text = (btn.innerText ?? btn.textContent ?? '').trim();
        if (!re.test(text)) return false;
        const r = btn.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }, this.guestSubmitPattern.source);
  }

  // Waits until the checkout state is active — either:
  //   a) The URL changes to a /checkout path (logged-in user, auth modal bypassed), or
  //   b) The checkout auth modal becomes visible (CONTINUE AS GUEST button visible).
  // Best-effort: wraps in .catch() so the caller's hard expect() is the source of truth.
  async waitForCheckoutLoad(): Promise<void> {
    await this.waits
      .waitForCustomCondition(
        async () => {
          const url = this.page.url();
          if (this.checkoutUrlPattern.test(url)) return true;
          return this.isAuthModalVisible();
        },
        { timeout: TIMEOUTS.PAGE_LOAD, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
  }

  // Returns true if the browser is on the checkout page.
  // Covers two cases: (a) /checkout URL (logged-in path), (b) auth modal visible (guest path).
  async isOnCheckoutPage(): Promise<boolean> {
    const url = this.page.url();
    if (this.checkoutUrlPattern.test(url)) return true;
    return this.isAuthModalVisible();
  }

  // Finds and clicks the checkout CTA button inside the mini-cart overlay panel.
  // Uses page.evaluate() to locate an element whose visible text matches the checkout CTA
  // pattern inside a positioned (fixed/absolute) overlay panel — same detection logic as
  // EcommerceCartOverlayPage.
  //
  // Clicking the CHECKOUT button opens the checkout auth modal on the same page (no navigation).
  // Call waitForCheckoutLoad() after this method to confirm the modal is active.
  async clickCheckoutCtaFromOverlay(): Promise<void> {
    const overlaySelector = this.overlayPanelSelector;
    const ctaPattern = this.checkoutCtaTextPattern.source;
    const ctaFlags = this.checkoutCtaTextPattern.flags;
    await this.page.evaluate(
      ({ selector, pattern, flags }: { selector: string; pattern: string; flags: string }) => {
        const ctaRe = new RegExp(pattern, flags);
        const panels = Array.from(document.querySelectorAll(selector));
        for (const panel of panels) {
          const r = (panel as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = getComputedStyle(panel as Element);
          if (style.position !== 'fixed' && style.position !== 'absolute') continue;
          // Iterate interactive elements inside the panel
          const candidates = Array.from(
            panel.querySelectorAll('a, button, input[type="submit"]'),
          );
          for (const el of candidates) {
            const elText = (
              el instanceof HTMLElement ? el.innerText : el.textContent ?? ''
            ).trim();
            if (!ctaRe.test(elText)) continue;
            const er = (el as Element).getBoundingClientRect();
            if (er.width === 0 || er.height === 0) continue;
            (el as HTMLElement).click();
            return;
          }
        }
      },
      { selector: overlaySelector, pattern: ctaPattern, flags: ctaFlags },
    );
  }

  // Clicks the primary submit/continue button on the current checkout step
  // WITHOUT filling any form fields — triggers validation.
  //
  // Priority order:
  //   1. "CONTINUE AS GUEST" — present at the auth modal step (guest track)
  //   2. Any button matching checkoutSubmitPattern — present on shipping/payment steps
  //
  // Clicking at the auth modal step (without a guest email) triggers:
  //   "Please enter your email address."
  // Clicking at the shipping step (without filling address) triggers shipping field errors.
  async submitCurrentStep(): Promise<void> {
    // Pass 1: try CONTINUE AS GUEST (auth modal step).
    // Uses page.evaluate() → btn.click() so the browser-native click propagates through
    // React's synthetic event system and triggers onSubmit / onChange validation handlers.
    // Playwright locator.click({ force: true }) was found to bypass React event delegation
    // on Skechers NZ and Dr. Martens NZ, leaving the guest-email validation container empty.
    const guestClicked = await this.page.evaluate((guestPattern: string) => {
      const re = new RegExp(guestPattern, 'i');
      const btns = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
      );
      for (const btn of btns) {
        const text = (btn.innerText ?? btn.textContent ?? '').trim();
        if (!re.test(text)) continue;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        btn.click();
        return true;
      }
      return false;
    }, this.guestSubmitPattern.source);

    if (guestClicked) return;

    // Pass 2: generic checkout submit button (shipping/payment/review steps)
    const submitPattern = this.checkoutSubmitPattern.source;
    const submitFlags = this.checkoutSubmitPattern.flags;
    await this.page.evaluate(
      ({ pattern, flags }: { pattern: string; flags: string }) => {
        const re = new RegExp(pattern, flags);
        const btns = Array.from(
          document.querySelectorAll('button, input[type="submit"]'),
        ) as HTMLButtonElement[];
        for (const btn of btns) {
          if (btn.disabled) continue;
          const text = (btn.innerText ?? btn.textContent ?? '').trim();
          if (!re.test(text)) continue;
          const r = btn.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          btn.click();
          return;
        }
      },
      { pattern: submitPattern, flags: submitFlags },
    );
  }

  // Returns true if any required-field validation error is visible on the current checkout step.
  //
  // Detection strategy (mirrors hasSizeValidationMessage() on EcommercePDPPage):
  //   1. ARIA signals first: [role="alert"] and [aria-live]:not([aria-live="off"])
  //   2. Text pattern fallback: leaf elements whose text matches validationTextPattern.
  //
  // Known validation text (from recon):
  //   Auth modal step (blank guest email): "Please enter your email address."
  //   Shipping step (blank fields):        varies per field
  //
  // Polls for DIALOG_APPEAR timeout to allow React state updates to commit before returning.
  async hasRequiredFieldValidation(): Promise<boolean> {
    const ariaSelector = this.ariaValidationSelector;
    const textPattern = this.validationTextPattern.source;
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(
            ({ ariasel, textpat }: { ariasel: string; textpat: string }) => {
              const isVisibleWithText = (el: Element): boolean => {
                const text =
                  (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                if (!text) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              };

              // 1. ARIA-based signals (preferred — semantic and hash-safe)
              if (
                Array.from(document.querySelectorAll(ariasel)).some(isVisibleWithText)
              ) {
                return true;
              }

              // 2. Plain-text validation messages (no ARIA role — e.g. "Please enter your email
              //    address." rendered in a plain div by Magento PWA checkout components).
              //    Pre-filter to elements whose text includes a validation keyword before
              //    applying the full regex, to avoid scanning thousands of DOM nodes.
              const re = new RegExp(textpat, 'i');
              return Array.from(document.querySelectorAll('*')).some((el) => {
                if ((el as Element).children.length > 0) return false;
                const text =
                  (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                if (!text) return false;
                // Pre-filter: text must contain at least one keyword to match
                if (
                  !/(please|required|must|invalid|cannot|blank)/i.test(text)
                ) {
                  return false;
                }
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

  // Returns true if a promo / coupon code input field is visible on the current checkout step.
  //
  // Detection strategy:
  //   1. Attribute-based: input[name*="coupon" i], input[placeholder*="promo" i], etc.
  //   2. Label-text fallback: any <input> whose associated <label> text matches
  //      coupon / promo / discount code.
  //
  // Polls for DIALOG_APPEAR timeout to allow lazy-rendered checkout sections to mount.
  async hasPromoCodeField(): Promise<boolean> {
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(() => {
            const isVisible = (el: Element): boolean => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            };

            // 1. Attribute-based detection (most reliable)
            const attrSelectors = [
              'input[name*="coupon" i]',
              'input[name*="promo" i]',
              'input[name*="discount" i]',
              'input[id*="coupon" i]',
              'input[id*="promo" i]',
              'input[id*="discount" i]',
              'input[placeholder*="coupon" i]',
              'input[placeholder*="promo" i]',
              'input[placeholder*="discount" i]',
              'input[aria-label*="coupon" i]',
              'input[aria-label*="promo" i]',
              'input[aria-label*="discount" i]',
            ];
            for (const sel of attrSelectors) {
              const el = document.querySelector(sel);
              if (el && isVisible(el)) return true;
            }

            // 2. Label-text fallback — find <label> whose text matches, then verify
            //    its associated input is visible.
            const promoRe = /coupon|promo|discount code/i;
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
              const text = (
                (label as HTMLElement).innerText ?? label.textContent ?? ''
              ).trim();
              if (!promoRe.test(text)) continue;
              const forId = (label as HTMLLabelElement).htmlFor;
              const input = forId
                ? document.getElementById(forId)
                : label.querySelector('input');
              if (input && isVisible(input)) return true;
            }

            return false;
          });return found;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return found;
  }// Returns the text content of all visible validation error messages on the current step.
  // Returns an empty array if none are found. Never throws.
  async getValidationMessages(): Promise<string[]> {
    const ariaSelector = this.ariaValidationSelector;
    const textPattern = this.validationTextPattern.source;
    return this.page.evaluate(
      ({ ariasel, textpat }: { ariasel: string; textpat: string }) => {
        const messages: string[] = [];
        const seen = new Set<string>();

        const addIfVisible = (el: Element): void => {
          const text =
            (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
          if (!text || seen.has(text)) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          seen.add(text);
          messages.push(text);
        };

        // ARIA signals
        Array.from(document.querySelectorAll(ariasel)).forEach(addIfVisible);

        // Text pattern fallback (leaf nodes only)
        const re = new RegExp(textpat, 'i');
        Array.from(document.querySelectorAll('*')).forEach((el) => {
          if ((el as Element).children.length > 0) return;
          const text =
            (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
          if (!text || !/(please|required|must|invalid|cannot|blank)/i.test(text)) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (!re.test(text)) return;
          if (!seen.has(text)) {
            seen.add(text);
            messages.push(text);
          }
        });

        return messages;
      },
      { ariasel: ariaSelector, textpat: textPattern },
    );
  }
}

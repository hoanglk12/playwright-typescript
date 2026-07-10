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

  // E2E-CHKOUT-002 — Attribute pattern that identifies an email-type input by its
  // type/name/id/placeholder/aria-label. Used to scope the guest-section email field
  // check to the auth modal (guest section), distinct from any unrelated email input
  // that may exist elsewhere on the page (e.g. a newsletter signup field).
  private readonly emailFieldPattern = /e-?mail/i;

  // E2E-CHKOUT-002 — Text pattern that identifies a login-section signal (a visible
  // login-submit button, e.g. "LOG IN & CONTINUE"). Used by isGuestEmailFieldVisible() as
  // a boundary marker: the ancestor-widening scan stops once it reaches a container that
  // also contains this signal (or a visible password input), so the guest-email search
  // never widens past the point where the login section's own email input could shadow it.
  private readonly loginSubmitPattern = /log\s*in/i;

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

  // E2E-CHKOUT-003 — RECON FINDINGS (Platypus AU staging, 2026-07-10, verified live via a
  // fixture-based throwaway spec that reused the real page-object methods):
  //   A valid guest email filled via a genuine CDP-level `fill()` (not a raw `.value =`
  //   assignment, which does not update React's controlled-input state) followed by
  //   submitCurrentStep()'s existing CONTINUE AS GUEST click DOES advance the flow: the
  //   auth modal closes (isGuestEmailFieldVisible() -> false) and the browser navigates to
  //   a dedicated /checkout URL (checkoutUrlPattern already matches this).
  //   The shipping form renders headings/legends "CHECKING OUT AS GUEST", "DELIVER TO",
  //   "DELIVERY METHOD *" and inputs named firstName/lastName/fullAddress/phoneNumber/email.
  //   Submitting the shipping form blank surfaces "Required fields marked with *" and
  //   "Please enter your details to see available shipping methods" — already caught by the
  //   existing validationTextPattern (matches "required"), so hasRequiredFieldValidation()
  //   needed no changes to detect shipping-step validation.
  //
  // Shipping-step heading/legend text pattern — identifies a shipping/delivery-specific
  // signal distinct from the auth-modal step (which never renders these terms).
  private readonly shippingStepHeadingPattern =
    /shipping|deliver(y|\s+to)|checking out as guest/i;

  // Shipping-step input attribute pattern — matches name/id/placeholder/aria-label on the
  // address-collection fields observed on the shipping form (firstName, lastName,
  // fullAddress, phoneNumber, and city/postcode/suburb variants on other storefronts).
  private readonly shippingFieldAttrPattern =
    /first-?name|last-?name|full-?address|address|post-?code|zip|suburb|city|phone/i;

  // Attribute name used to tag the guest-section email input (see tagGuestEmailInput())
  // so a genuine Playwright locator can .fill() it — CDP-level fill correctly triggers
  // React's onChange handler; a raw DOM `.value =` assignment does not.
  private readonly guestEmailTargetAttr = 'data-qa-guest-email-target';
  private readonly guestEmailTargetSelector = '[data-qa-guest-email-target="true"]';

  // Promo/discount code field detection patterns (E2E-CART-010).
  //
  // Promotional code fields are rendered inconsistently across the 8 Magento PWA storefronts:
  //   - Input may be type="text" with placeholder/aria-label/name/id like
  //     "Promo code", "Discount code", "Coupon code", "Voucher code", "Enter promo code"
  //   - Input may be associated with a nearby label/legend text matching the same keywords
  //   - An "Apply" / "Apply code" / "Apply discount" / "Apply coupon" button may appear
  //     alongside (per discovery report context "promo/discount code field")
  //
  // Pattern sources are passed as `.source` strings into page.evaluate(...) — same pattern
  // as validationTextPattern/ariaValidationSelector above — so the regex is reconstructed
  // inside the browser context where new RegExp(pattern) is needed.
  private readonly promoKeywordPattern = /promo|discount|coupon|voucher/i;

  // Pattern that an Apply button label would match — used for the secondary
  // "Apply promo button visible" check recommended by the discovery report.
  private readonly promoApplyButtonPattern =
    /apply.*(promo|discount|coupon|voucher|code)|(promo|discount|coupon|voucher).*code/i;

  constructor(page: Page) {
    super(page);
  }

  // Detects whether the checkout auth modal is visible.
  // The modal appears on the same page (URL unchanged) after clicking CHECKOUT in the overlay.
  // Identified by the presence of visible "CONTINUE AS GUEST" or "LOG IN & CONTINUE" buttons.
  // E2E-CHKOUT-003 — exposed publicly (was private) so isOnShippingStep() can use it as the
  // "auth modal confirmed closed" gate: the shipping form is only reachable once this is false.
  async isAuthModalVisible(): Promise<boolean> {
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

  // E2E-CHKOUT-002 — Returns true if a visible, enabled email input is present in the guest
  // section of the checkout auth modal (i.e. near the "CONTINUE AS GUEST" button). The scan
  // widens outward from the guest CTA one ancestor level at a time but stops as soon as it
  // reaches a container that also carries a login-section signal (a visible password input,
  // or a visible button/submit matching loginSubmitPattern) — that container is treated as
  // the outer boundary between the guest and login sections, so the search never widens far
  // enough to pick up the login section's own email input. This is not an absolute DOM
  // boundary marker (Magento PWA storefronts nest the guest/login sections at varying
  // depths inside a shared modal wrapper), but the login-signal check is what enforces
  // correctness rather than any fixed nesting depth. Detection strategy:
  //   1. Locate a visible button/submit matching guestSubmitPattern (the guest CTA).
  //   2. Walk up ancestor containers one level at a time from the guest CTA.
  //   3. At each level, look for a visible, enabled input matching type="email" or an
  //      email-ish name/id/placeholder/aria-label attribute — return true if found.
  //   4. At each level, also check for a login-section signal. If present, this level is
  //      the outer boundary — stop widening after checking it for the email match above
  //      (do not continue to the parent container).
  //   5. If no login signal is present, continue widening to the next ancestor. The walk
  //      is naturally bounded by the DOM tree (stops at document.body / no parent) — no
  //      arbitrary depth cap is used, since the login-boundary check is the real scoping
  //      mechanism.
  // Never throws — returns false on any detection failure.
  async isGuestEmailFieldVisible(): Promise<boolean> {
    return this.page
      .evaluate(
        ({
          guestPattern,
          emailPattern,
          loginPattern,
        }: {
          guestPattern: string;
          emailPattern: string;
          loginPattern: string;
        }) => {
          const guestRe = new RegExp(guestPattern, 'i');
          const emailRe = new RegExp(emailPattern, 'i');
          const loginRe = new RegExp(loginPattern, 'i');

          const isVisible = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
            if (parseFloat(style.opacity || '1') === 0) return false;
            return true;
          };

          const isEmailInput = (input: HTMLInputElement): boolean => {
            if (input.disabled) return false;
            if (input.type === 'email') return true;
            const attrs = ['name', 'id', 'placeholder', 'aria-label'];
            return attrs.some((a) => {
              const v = input.getAttribute(a) ?? '';
              return v !== '' && emailRe.test(v);
            });
          };

          // Login-section boundary signal: a visible password input, or a visible
          // button/submit whose text matches loginPattern (e.g. "LOG IN & CONTINUE").
          const hasLoginSignal = (container: Element): boolean => {
            const hasPasswordInput = Array.from(
              container.querySelectorAll<HTMLInputElement>('input[type="password"]'),
            ).some(isVisible);
            if (hasPasswordInput) return true;

            const loginBtns = Array.from(
              container.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
            );
            return loginBtns.some((b) => {
              const text = (b.innerText ?? b.textContent ?? '').trim();
              return loginRe.test(text) && isVisible(b);
            });
          };

          const guestBtns = Array.from(
            document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
          ).filter((btn) => {
            const text = (btn.innerText ?? btn.textContent ?? '').trim();
            return guestRe.test(text) && isVisible(btn);
          });

          for (const btn of guestBtns) {
            let container: Element | null = btn.parentElement;
            // The tightest ancestor is scanned even if it already carries a login signal —
            // at that level guest and login markup are genuinely intermixed and there is no
            // narrower guest-only container to fall back to. Every wider ancestor is gated:
            // once a login signal appears, the email scan is skipped for that container (and
            // any container beyond it), because scanning it risks matching the login section's
            // own email input instead of the guest section's.
            let isTightestAncestor = true;
            while (container) {
              const loginBoundary = hasLoginSignal(container);
              if (!loginBoundary || isTightestAncestor) {
                const inputs = Array.from(
                  container.querySelectorAll<HTMLInputElement>('input'),
                );
                const match = inputs.find((input) => isVisible(input) && isEmailInput(input));
                if (match) return true;
              }

              // Stop widening once this container carries a login-section signal — it is the
              // outer boundary between the guest and login sections.
              if (loginBoundary) break;

              // Safety net: stop at document.body (or once the ancestor chain is exhausted)
              // so the walk cannot run past the page root. This is a runaway guard only —
              // the login-signal check above is the mechanism that enforces scoping.
              if (container === document.body || !container.parentElement) break;
              container = container.parentElement;
              isTightestAncestor = false;
            }
          }
          return false;
        },
        {
          guestPattern: this.guestSubmitPattern.source,
          emailPattern: this.emailFieldPattern.source,
          loginPattern: this.loginSubmitPattern.source,
        },
      )
      .catch(() => false);
  }

  // E2E-CHKOUT-003 — Locates the guest-section email input using the SAME ancestor-widening
  // scan as isGuestEmailFieldVisible() (guest CTA -> widen until a login-signal boundary) and
  // tags it with a temporary marker attribute so fillGuestEmailAndContinue() can interact with
  // it through a genuine Playwright locator. A raw DOM `.value =` assignment does not update
  // React's controlled-input state — only a real CDP-level fill (dispatched via
  // this.elements.enterText) reliably triggers the onChange handler that CONTINUE AS GUEST
  // validation depends on. Returns true if an input was found and tagged. Never throws.
  private async tagGuestEmailInput(): Promise<boolean> {
    return this.page
      .evaluate(
        ({
          guestPattern,
          emailPattern,
          loginPattern,
          targetAttr,
        }: {
          guestPattern: string;
          emailPattern: string;
          loginPattern: string;
          targetAttr: string;
        }) => {
          const guestRe = new RegExp(guestPattern, 'i');
          const emailRe = new RegExp(emailPattern, 'i');
          const loginRe = new RegExp(loginPattern, 'i');

          const isVisible = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const style = getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
            if (parseFloat(style.opacity || '1') === 0) return false;
            return true;
          };

          const isEmailInput = (input: HTMLInputElement): boolean => {
            if (input.disabled) return false;
            if (input.type === 'email') return true;
            const attrs = ['name', 'id', 'placeholder', 'aria-label'];
            return attrs.some((a) => {
              const v = input.getAttribute(a) ?? '';
              return v !== '' && emailRe.test(v);
            });
          };

          const hasLoginSignal = (container: Element): boolean => {
            const hasPasswordInput = Array.from(
              container.querySelectorAll<HTMLInputElement>('input[type="password"]'),
            ).some(isVisible);
            if (hasPasswordInput) return true;

            const loginBtns = Array.from(
              container.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
            );
            return loginBtns.some((b) => {
              const text = (b.innerText ?? b.textContent ?? '').trim();
              return loginRe.test(text) && isVisible(b);
            });
          };

          const guestBtns = Array.from(
            document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
          ).filter((btn) => {
            const text = (btn.innerText ?? btn.textContent ?? '').trim();
            return guestRe.test(text) && isVisible(btn);
          });

          for (const btn of guestBtns) {
            let container: Element | null = btn.parentElement;
            let isTightestAncestor = true;
            while (container) {
              const loginBoundary = hasLoginSignal(container);
              if (!loginBoundary || isTightestAncestor) {
                const inputs = Array.from(
                  container.querySelectorAll<HTMLInputElement>('input'),
                );
                const match = inputs.find((input) => isVisible(input) && isEmailInput(input));
                if (match) {
                  match.setAttribute(targetAttr, 'true');
                  return true;
                }
              }

              if (loginBoundary) break;
              if (container === document.body || !container.parentElement) break;
              container = container.parentElement;
              isTightestAncestor = false;
            }
          }
          return false;
        },
        {
          guestPattern: this.guestSubmitPattern.source,
          emailPattern: this.emailFieldPattern.source,
          loginPattern: this.loginSubmitPattern.source,
          targetAttr: this.guestEmailTargetAttr,
        },
      )
      .catch(() => false);
  }

  // E2E-CHKOUT-003 — Fills the guest-section email input in the checkout auth modal with a
  // valid email and submits it via CONTINUE AS GUEST, advancing the flow from the auth modal
  // into the shipping address form. Callers must confirm the transition with
  // isOnShippingStep() before treating the shipping form as active (see that method's doc).
  async fillGuestEmailAndContinue(email: string): Promise<void> {
    const tagged = await this.tagGuestEmailInput();
    if (tagged) {
      await this.elements.enterText(this.guestEmailTargetSelector, email);
    }
    await this.submitCurrentStep();
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

  // E2E-CHKOUT-003 — Positively confirms the shipping address form is active, distinct from
  // the checkout auth-modal step. Two-part gate:
  //   1. The auth modal must be confirmed CLOSED (isAuthModalVisible() false) — this rules
  //      out the false-positive where the modal never advanced and a second
  //      submitCurrentStep() call would just re-click the same guest CTA again.
  //   2. A shipping-specific signal must be present: a visible heading/legend matching
  //      shippingStepHeadingPattern (e.g. "DELIVER TO", "DELIVERY METHOD") OR a visible input
  //      whose name/id/placeholder/aria-label matches shippingFieldAttrPattern (e.g.
  //      firstName, lastName, fullAddress, phoneNumber, postcode/city/suburb variants).
  // Never throws — returns false on any detection failure (fails safe, since callers hard-
  // assert this as a precondition gate).
  async isOnShippingStep(): Promise<boolean> {
    const headingPattern = this.shippingStepHeadingPattern.source;
    const fieldPattern = this.shippingFieldAttrPattern.source;
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          const authModalVisible = await this.isAuthModalVisible();
          if (authModalVisible) return false;

          found = await this.page.evaluate(
            ({ headingSrc, fieldSrc }: { headingSrc: string; fieldSrc: string }) => {
              const headingRe = new RegExp(headingSrc, 'i');
              const fieldRe = new RegExp(fieldSrc, 'i');

              const isVisible = (el: Element): boolean => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              };

              const headingMatch = Array.from(
                document.querySelectorAll('h1, h2, h3, h4, legend'),
              ).some((el) => {
                const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                return text !== '' && headingRe.test(text) && isVisible(el);
              });
              if (headingMatch) return true;

              return Array.from(document.querySelectorAll<HTMLInputElement>('input')).some(
                (input) => {
                  if (!isVisible(input)) return false;
                  const attrs = ['name', 'id', 'placeholder', 'aria-label'];
                  return attrs.some((a) => {
                    const v = input.getAttribute(a) ?? '';
                    return v !== '' && fieldRe.test(v);
                  });
                },
              );
            },
            { headingSrc: headingPattern, fieldSrc: fieldPattern },
          );
          return found;
        },
        { timeout: TIMEOUTS.PAGE_LOAD, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return found;
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

  // Returns the text content of all visible validation error messages on the current step.
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

  // E2E-CART-010 — Navigates directly to the /cart page. Used so callers can guarantee the
  // promo/discount field scan happens against /cart specifically, rather than relying on
  // isPromoCodeFieldVisible()'s Pass-1 scan of whatever surface (PDP, mini-cart overlay) is
  // currently loaded. Uses a relative URL to preserve the current storefront origin and
  // SPA session, same pattern as the Pass-2 navigation inside isPromoCodeFieldVisible().
  async navigateToCart(): Promise<void> {
    await this.gotoWithOptions(new URL('/cart', this.page.url()).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUTS.NETWORK_IDLE_SLOW,
    });
  }

  // E2E-CART-010 — Returns true if a promo/discount/coupon/voucher code field is reachable
  // from the current checkout entry. Magento PWA storefronts expose this field in one of
  // three surfaces: the order-summary panel on the shipping step, a "Have a code?" link in
  // the mini-cart overlay, or — most commonly — the /cart page. This method scans ALL
  // surfaces by first probing the current DOM, then navigating to /cart and re-scanning.
  async isPromoCodeFieldVisible(): Promise<boolean> {
    const promoKeyword = this.promoKeywordPattern.source;
    const promoApply = this.promoApplyButtonPattern.source;

    // Pass 1: scan current page DOM (checkout step + any visible overlays).
    if (await this.scanForPromoField(promoKeyword, promoApply)) {
      return true;
    }

    // Pass 2: navigate to /cart and re-scan. Most Magento PWAs expose the promo field here
    // (typically an expandable "Have a promo code?" link). Uses relative URL to preserve
    // the current storefront origin and SPA session.
    try {
      await this.gotoWithOptions(new URL('/cart', this.page.url()).toString(), {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUTS.NETWORK_IDLE_SLOW,
      });
      await this.waits
        .waitForCustomCondition(
          async () =>
            this.page
              .evaluate(() => document.body !== null && document.body.innerText.length > 0)
              .catch(() => false),
          { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
        )
        .catch(() => {});
      return await this.scanForPromoField(promoKeyword, promoApply);
    } catch {
      return false;
    }
  }

  // Internal helper: scans the current page DOM for a promo/discount code field. Pattern-
  // based scan (no CSS) — matches any visible text-input whose name/id/placeholder/aria-label
  // or associated label text matches the promo keyword pattern (promo|discount|coupon|voucher).
  // Returns true as soon as ANY signal is found. Never throws.
  private async scanForPromoField(keywordSource: string, applySource: string): Promise<boolean> {
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(
            ({ keywordSource, applySource }: { keywordSource: string; applySource: string }) => {
              const keywordRe = new RegExp(keywordSource, 'i');
              const isVisible = (el: Element): boolean => {
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) return false;
                const style = getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none') return false;
                if (parseFloat(style.opacity || '1') === 0) return false;
                return true;
              };
              const fieldAttrMatches = (el: Element): boolean => {
                const attrs = ['name', 'id', 'placeholder', 'aria-label', 'data-testid', 'title'];
                for (const a of attrs) {
                  const v = el.getAttribute(a) ?? '';
                  if (v && keywordRe.test(v)) return true;
                }
                return false;
              };
              const labelTextForInput = (input: Element): string => {
                const id = input.getAttribute('id');
                if (id) {
                  const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
                  if (lbl && isVisible(lbl)) {
                    return ((lbl as HTMLElement).innerText ?? lbl.textContent ?? '').trim();
                  }
                }
                const parentLabel = input.closest('label');
                if (parentLabel && isVisible(parentLabel)) {
                  return ((parentLabel as HTMLElement).innerText ?? parentLabel.textContent ?? '').trim();
                }
                const labelledBy = input.getAttribute('aria-labelledby');
                if (labelledBy) {
                  const ref = document.getElementById(labelledBy);
                  if (ref && isVisible(ref)) {
                    return ((ref as HTMLElement).innerText ?? ref.textContent ?? '').trim();
                  }
                }
                return '';
              };
              const nearbyLabelMatches = (input: Element): boolean => {
                const directLabel = labelTextForInput(input);
                if (directLabel && keywordRe.test(directLabel)) return true;
                let parent: Element | null = input.parentElement;
                for (let depth = 0; depth < 2 && parent; depth++) {
                  const candidates = Array.from(
                    parent.querySelectorAll('label, legend, span, div, p'),
                  );
                  for (const c of candidates) {
                    if (c.contains(input)) continue;
                    if (!isVisible(c)) continue;
                    if ((c as Element).children.length > 0) continue;
                    const txt = ((c as HTMLElement).innerText ?? c.textContent ?? '').trim();
                    if (txt && keywordRe.test(txt)) return true;
                  }
                  parent = parent.parentElement;
                }
                return false;
              };
              const textInputs = Array.from(
                document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'),
              );
              for (const input of textInputs) {
                if (!isVisible(input)) continue;
                if (input.disabled || input.readOnly) continue;
                if (fieldAttrMatches(input)) return true;
                if (nearbyLabelMatches(input)) return true;
              }
              return false;
            },
            { keywordSource, applySource },
          );
          return found;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return found;
  }

  // E2E-CART-010 (recommended secondary check) — Returns true if an "Apply promo/discount/
  // coupon/voucher code" button is visible at the current checkout entry point. Mirrors the
  // Apply-button branch of isPromoCodeFieldVisible() but exposed as a standalone helper for
  // callers that want to split the promo-input and apply-button assertions.
  async hasApplyPromoButton(): Promise<boolean> {
    const applyPattern = this.promoApplyButtonPattern.source;
    return this.page.evaluate((pattern: string) => {
      const re = new RegExp(pattern, 'i');
      const btns = Array.from(
        document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
      );
      return btns.some((btn) => {
        if (btn.disabled) return false;
        const text = ((btn as HTMLElement).innerText ?? btn.value ?? btn.textContent ?? '').trim();
        if (!re.test(text)) return false;
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const style = getComputedStyle(btn);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return true;
      });
    }, applyPattern);
  }
}

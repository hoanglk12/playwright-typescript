import { type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';
import { type GuestShippingAddress } from '../../data/ecommerce/test-accounts';
import { type PayPalSandboxAccount } from '../../data/ecommerce/payment-accounts';

export interface OrderSummaryTotals {
  subtotal: number | null;
  delivery: number | null;
  total: number | null;
  /**
   * Sum of any negative-token promotion/discount lines rendered between the subtotal and total
   * (e.g. "Singles Day 25% Off Full Price -$35.25" — confirmed live on Vans AU staging). Already
   * negative; add it directly when reconstructing total from its parts:
   * total ≈ subtotal + delivery + discount. Null when no discount line is present.
   */
  discount: number | null;
}

// E2E-PLAORD-001 — Outcome of fillGuestShippingAddress(), split into two independently
// meaningful signals rather than one boolean: an autocomplete that never returned a suggestion
// (region/data mismatch) and contact fields that never settled on their intended values
// (sibling-remount race) are different problems, and a caller that collapses them reports the
// wrong cause in its skip/failure message.
export interface GuestShippingFillResult {
  addressSelected: boolean;
  contactFieldsSettled: boolean;
  /**
   * DIAGNOSTIC ONLY — no caller gates on this. Whether the address input still held a value
   * after the post-commit contact re-fill. Exists to collect live evidence for a suspected (not
   * yet observed) failure mode: the contact re-fill remounting the address input and discarding
   * the committed suggestion, which `addressSelected` alone would not catch. It is deliberately
   * not a gate — it is a single-shot read against the most remount-prone form in this file, so
   * gating on it would risk converting a transient mid-remount read into a spurious skip.
   *
   * A false reading means INVESTIGATE, not "wipe confirmed": this read can itself report false
   * without any wipe, because readTaggedFieldValue() re-tags via shippingAddressFieldPattern
   * (which could match a different address-ish input a storefront renders post-commit) and
   * tagFieldByAttrPattern() skips disabled inputs. Confirm the cause on a live run first; if it
   * is a genuine wipe, promote this to a polled gate — never a single-shot one.
   */
  addressStillFilled: boolean;
}

// E2E-CHKOUT-004 — One-shot forensic snapshot taken when getSelectableShippingMethodCount()
// reads 0, distinguishing failure causes a bare "0" cannot: no radios rendered at all (backend
// never returned rates) vs radios rendered but still disabled (recalculation stalled) vs the
// "Hang tight..." loading placeholder still showing vs the committed address having been lost
// by the time this snapshot is taken.
export interface ShippingMethodDiagnostics {
  totalRadioCount: number;
  enabledRadioCount: number;
  visibleRadioCount: number;
  loadingTextVisible: boolean;
  committedAddressValue: string | null;
  pageText: string;
}

// E2E-CHKOUT-006 — A single product line item as rendered in the order-review surface.
export interface OrderReviewLineItem {
  /**
   * Concatenated text of every line between the item's position in the list and its
   * "Qty: <n>" line (typically brand + product name + a "<colour> | <size>" variant line —
   * see the class-level recon docblock above getOrderReviewLineItems()). Callers should use a
   * substring/contains match against the product name captured at ATC time (e.g.
   * EcommercePDPPage.getProductName()) rather than an exact-equality match, since the exact
   * line composition/order is storefront-dependent.
   */
  name: string;
  quantity: number;
  /** Line price, parsed the same way as OrderSummaryTotals prices. Null if not parseable. */
  price: number | null;
}

// E2E-CHKOUT-004 — RECON FINDINGS (Platypus AU staging, 2026-07-11, verified live via a
// fixture-based throwaway spec that reused the real page-object methods):
//   The shipping form's "Address *" field is a SINGLE free-text input (name="fullAddress",
//   the same field documented above under E2E-CHKOUT-003) backed by an address-autocomplete
//   API — there are no separate suburb/postcode/city inputs on the default (non-manual) form.
//   A plain fill() (single combined input event) types text into the field but the
//   suggestion dropdown NEVER renders and the delivery-method radios stay disabled with
//   "Delivery $0.00" in the order summary — confirmed by directly comparing fill() vs
//   pressSequentially() against the live form. Only pressSequentially() (real per-character
//   keydown/input events) triggers the debounced suggestion lookup. Suggestions render as
//   plain sibling <div> elements (hashed class names, no role="option"/listbox semantics)
//   positioned below the input, each containing a comma-separated formatted address
//   (e.g. "123 Thistle St, BLACKALL, QLD, 4472"). Clicking a suggestion element commits the
//   address and — after the shipping-method rates recalculate — enables the corresponding
//   delivery-method radio input(s); an address left as free/uncommitted text leaves ALL
//   delivery-method radios disabled and unchecked.
//
//   Delivery methods render as native <input type="radio" disabled> wrapped in a <label>
//   with no shared `name` attribute; the wrapping <label> (not the disabled-by-default radio
//   itself) is the reliable click target — clicking the label toggles `checked` once the
//   radio is enabled.
//
//   The order summary ("ORDER SUMMARY" panel) always renders "Subtotal" / a price line /
//   [a shipping-cost line] / "Total" / "Including GST" / a price line, in that fixed order —
//   but the LABEL on the shipping-cost line is NOT stable: it reads "Delivery" ($0.00) before
//   any method is selected, then changes to the selected method's own label (e.g. "Fixed" for
//   Flat Rate) once a method is chosen. getOrderSummaryTotals() therefore reads the shipping
//   cost POSITIONALLY (the price line between the subtotal price and the "Total" label)
//   instead of matching a fixed "Delivery" label string.

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
  // login-submit button, e.g. "LOG IN & CONTINUE"). Used by findGuestEmailInput() as
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

  // Attribute name used to tag the guest-section email input (see findGuestEmailInput())
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
  //
  // E2E-CHKOUT-008 — RECON FINDING (confirmed live, Platypus AU staging, via a fixture-based
  // throwaway recon spec that reused the real page-object methods): the real submit control
  // for the promo form renders with the bare text "Apply" (`<button type="submit"><span>Apply
  // </span></button>`), with no "promo/discount/coupon/voucher/code" word in its own text. The
  // form's accordion trigger, however, renders as `<button type="button">Enter promo code</button>`
  // — its text contains both "promo" and "code", so the original pattern's second alternative
  // `(promo|discount|coupon|voucher).*code` matched the ACCORDION TOGGLE instead of the real
  // Apply button, and — since scanApplyPromoButton() takes the first DOM match — always clicked
  // the toggle. Because the promo section was already expanded (scanForPromoField() had already
  // found and filled the input), clicking the toggle again collapsed the section without ever
  // submitting the code, so no rejection message ever appeared. Anchoring on the word "apply"
  // itself (present in every variant the discovery report documented — "Apply", "Apply code",
  // "Apply discount", "Apply coupon") avoids matching the toggle, whose label never contains it.
  private readonly promoApplyButtonPattern = /\bapply\b/i;

  // E2E-CHKOUT-008 — Attribute used to tag the promo/discount input located by
  // scanForPromoField() so applyPromoCode() can fill it through a genuine Playwright locator
  // (mirrors guestEmailTargetAttr/shippingAddressTargetAttr — a raw DOM value assignment does
  // not update React's controlled-input state).
  private readonly promoCodeTargetAttr = 'data-qa-promo-code-target';
  private readonly promoCodeTargetSelector = '[data-qa-promo-code-target="true"]';

  // E2E-CHKOUT-008 — Rejection vocabulary for an invalid/expired promo code. Kept distinct
  // from validationTextPattern: that pattern targets required-field messages ("please enter",
  // "is required") and its "invalid" alternative does not match Magento's actual coupon-rejection
  // string ("The coupon code isn't valid...") — n['']?t\s*valid covers the contracted form that
  // a bare "not\s*valid" alternative would miss.
  private readonly promoCodeErrorTextPattern =
    /invalid|expired|n['’]?t\s*valid|no longer valid|cannot be applied|does not exist|not found/i;

  // E2E-CHKOUT-008 — Co-occurrence check paired with promoCodeErrorTextPattern in
  // scanForPromoCodeError(): rejection vocabulary alone ("invalid", "expired", "not found") is
  // common in unrelated cart/payment copy, so a candidate element's text must ALSO reference the
  // promo/coupon context.
  //
  // RECON FINDING (confirmed live, all 8 GRA storefronts, 2026-08-01): Magento's actual
  // coupon-rejection copy is `"<code>" is invalid. Please check spelling & try again.` — it
  // echoes the submitted code back but never uses the words "promo", "discount", "coupon", or
  // "voucher", so this pattern's own "code" alternative was the only one that could ever match
  // it, and "code" alone is too loose for its stated purpose (it also matches "postcode" in
  // unrelated shipping-form copy elsewhere on /cart). scanForPromoCodeError() therefore treats
  // the submitted code being echoed back in the candidate text as an equally valid, and
  // strictly tighter, context signal — see the code-echo check there. This pattern remains the
  // fallback for storefronts/messages that reference promo context by name instead of echoing
  // the code.
  private readonly promoErrorContextPattern = /promo|discount|coupon|voucher/i;

  // E2E-CHKOUT-004 — Attribute patterns identifying each individual shipping-form field by
  // name/id/placeholder/aria-label, used one at a time with tagFieldByAttrPattern() so each
  // field can be filled through a genuine Playwright locator (mirrors findGuestEmailInput()'s
  // fill-via-real-locator rationale — a raw DOM value assignment does not update React state).
  private readonly shippingFirstNameFieldPattern = /first-?name/i;
  private readonly shippingLastNameFieldPattern = /last-?name/i;
  private readonly shippingPhoneFieldPattern = /phone/i;
  private readonly shippingAddressFieldPattern = /full-?address|^address$/i;

  private readonly shippingFirstNameTargetAttr = 'data-qa-shipping-firstname-target';
  private readonly shippingFirstNameTargetSelector = '[data-qa-shipping-firstname-target="true"]';
  private readonly shippingLastNameTargetAttr = 'data-qa-shipping-lastname-target';
  private readonly shippingLastNameTargetSelector = '[data-qa-shipping-lastname-target="true"]';
  private readonly shippingPhoneTargetAttr = 'data-qa-shipping-phone-target';
  private readonly shippingPhoneTargetSelector = '[data-qa-shipping-phone-target="true"]';
  private readonly shippingAddressTargetAttr = 'data-qa-shipping-address-target';
  private readonly shippingAddressTargetSelector = '[data-qa-shipping-address-target="true"]';

  // E2E-CHKOUT-004 — Order summary parsing patterns. The shipping-cost line's label is not
  // stable (see the class-level recon docblock), so getOrderSummaryTotals() locates the
  // "Subtotal" and "Total" labels and reads prices positionally rather than matching a
  // "Delivery" label directly.
  private readonly orderSummaryHeadingPattern = /order summary/i;
  private readonly summarySubtotalLabelPattern = /^subtotal$/i;
  private readonly summaryTotalLabelPattern = /^total$/i;
  private readonly summaryPriceTokenPattern = /^\$\d+(\.\d{2})?$/;

  // E2E-CHKOUT-004 — RECON FINDING (confirmed live, Vans AU staging): the order summary can
  // render a promotion/discount line ("Singles Day 25% Off Full Price", "-$35.25") between the
  // subtotal price and the delivery/total lines. summaryPriceTokenPattern deliberately does NOT
  // match this token (no leading "-"), so it never contaminates the delivery/total positional
  // parse — but it DOES mean total != subtotal + delivery whenever a discount is present unless
  // the discount is also captured. This pattern parses that negative token separately.
  private readonly summaryDiscountTokenPattern = /^-\$\d+(\.\d{2})?$/;

  // E2E-CHKOUT-006 — RECON FINDING (confirmed live, Platypus AU staging, single-worker run via
  // a throwaway fixture-based recon spec that reused the real page-object methods, mirroring
  // the E2E-CHKOUT-003/004 recon approach): after a guest email is submitted and the shipping
  // form becomes active, the SAME "ORDER SUMMARY" panel that getOrderSummaryTotals() reads
  // appends a "<N> ITEM" / "<N> ITEMS" heading below the Subtotal/Delivery/Total/GST lines,
  // followed by an "Edit" link and then, per item and in this fixed order: one or more name
  // lines (observed as a brand line + a product-name line, e.g. "Converse" / "Chuck Taylor All
  // Star Lift Lo" — the product-name line matches EcommercePDPPage.getProductName() exactly), a
  // "<colour> | <size>" variant line (e.g. "White | 5 US Womens"), a "Qty: <n>" line, and a
  // price token. This list is already fully rendered BEFORE any shipping method has been
  // selected — the Delivery line can still read the pre-selection "$0.00" placeholder while the
  // item list itself is complete — so no shipping-method selection is required to reach this
  // data. No distinct post-shipping "order review" step exists that is reachable without
  // entering payment details (CONTINUE TO PAYMENT is the next action after this panel); this
  // shipping-step order summary panel IS the pre-payment order-review surface for
  // E2E-CHKOUT-006. getOrderReviewLineItems() therefore scopes into the same "ORDER SUMMARY"
  // heading as getOrderSummaryTotals() and reads the item list positionally, mirroring how the
  // totals themselves are read.
  private readonly orderReviewItemsHeaderPattern = /^\d+\s*items?$/i;
  private readonly orderReviewEditLinePattern = /^edit$/i;
  private readonly orderReviewQtyLinePattern = /^qty:?\s*\d+$/i;

  // Loading-placeholder text shown while shipping-method rates are being recalculated.
  // Also used to exclude the placeholder from address-suggestion detection, since it contains
  // a comma and would otherwise false-match the suggestion heuristic (confirmed live).
  private readonly shippingMethodsLoadingTextPattern = /hang tight|finding the best option/i;

  // E2E-PLAORD-001 — RECON FINDINGS (Platypus AU staging, confirmed live via playwright-cli
  // against a real Braintree sandbox PayPal round-trip):
  //   The payment step (reached after CONTINUE TO PAYMENT — already covered by
  //   checkoutSubmitPattern's "continue" match, no new submit handling needed) renders one
  //   native <input type="radio"> per payment method, each carrying a semantic Magento payment-
  //   method code in its `value` attribute: "afterpay_gra", "braintree_gra" (Credit or Debit
  //   Card), "braintree_paypal_gra" (PayPal), "braintree_paypal_pay_in_4_gra" (PayPal Pay in
  //   4). None of the four inputs share a `name` attribute, so — unlike the accessible name
  //   "PayPal", which is NOT a safe match target because "PayPal Pay in 4" contains it as a
  //   substring — the `value="braintree_paypal_gra"` attribute selector is both stable
  //   (Magento's own payment-method code, not a hashed class) and unambiguous.
  //
  //   Selecting this radio renders a genuine PayPal-hosted Smart Payment Button inside a
  //   cross-origin <iframe title="PayPal" src="https://www.sandbox.paypal.com/smart/button...">
  //   that REPLACES the storefront's own "place order" button — there is no separate "place
  //   order" click for the PayPal path, the Smart Button itself is the submit action. The
  //   iframe's `name` attribute is a long session-scoped hash that changes every page load and
  //   cannot be used as a selector; `title="PayPal"` is the SDK's own stable accessibility
  //   title and was confirmed unique among the ~7 iframes present on the payment step (the
  //   others are PayPal "dispatch" frames, an "about:blank" frame, and a messaging-window
  //   launcher). Because this iframe is genuinely cross-origin, `page.evaluate()` cannot reach
  //   its content (browser same-origin policy) — this.frames (FrameHelper), which resolves via
  //   Playwright's frameLocator rather than in-page script, is the only viable interaction path
  //   here, hence the deviation from this file's usual page.evaluate() DOM-scan convention for
  //   these specific methods.
  //
  //   Clicking the Smart Button opens a genuine POPUP window (not an inline iframe form) at
  //   www.sandbox.paypal.com — confirmed sandbox, not live PayPal. Two distinct popup states
  //   were observed depending on whether the sandbox buyer already has an active PayPal
  //   session in the browser context: (a) a login form — "Email or mobile number" textbox +
  //   "Next" button, followed by a "Password" textbox + "Log In" button; or (b) — only when a
  //   prior PayPal session cookie exists — the review screen directly. Both funnel into the
  //   same final review screen, confirmable via PayPal's own `data-testid="submit-button-
  //   initial"` on the confirm button (captured from the actual Playwright call the recon
  //   session generated when clicking it) — used as the primary selector since it does not
  //   depend on the visible "Agree & Continue" label, which PayPal varies by buyer/funding
  //   state. Clicking it authorises the sandbox payment; the popup closes itself (no explicit
  //   close action needed) and the opener storefront tab asynchronously navigates to
  //   `/ordersuccess`, rendering an `h1` "Nice work, you did it!" and a "Order Number <code>"
  //   paragraph. The navigation is NOT instant — it lagged several seconds behind the popup
  //   closing in recon — so waitForOrderSuccess() polls the opener's URL rather than assuming
  //   an immediate redirect, and the popup tab is only closed by this page object AFTER that
  //   poll resolves (closing it earlier was tried and cuts off the approval callback the
  //   opener is still waiting on).
  // E2E-PLAORD-001 — RECON FINDING (confirmed live, automated Chromium run against Platypus AU
  // staging): CONTINUE TO PAYMENT's disabled state does not clear in the same tick as a
  // delivery-method radio becoming `checked` — a debounce lag consistent with the
  // getCheckedShippingMethodIndex() / waitForShippingSelectionSettled() races already
  // documented above for the radios themselves. Calling submitCurrentStep() immediately after
  // confirming a checked radio can still find CONTINUE TO PAYMENT disabled and silently no-op
  // (submitCurrentStep()'s Pass 2 skips disabled buttons), leaving the flow stuck on the
  // shipping step even though the button reliably becomes clickable moments later.
  // waitForContinueToPaymentEnabled() closes this gap. `:has-text()` is a Playwright-specific
  // CSS pseudo-class (not a raw browser selector), safe to use with ElementHelper the same way
  // plain CSS selectors are used elsewhere in this file.
  private readonly continueToPaymentButtonSelector = 'button:has-text("CONTINUE TO PAYMENT")';
  private readonly braintreePaypalRadioSelector = 'input[type="radio"][value="braintree_paypal_gra"]';
  private readonly paypalSmartButtonFrameSelector = 'iframe[title="PayPal"]';
  // RECON FINDING (confirmed live, automated Chromium run): PayPal's Smart Payment Button
  // renders as a `<div role="button" tabindex="0">`, not a `<button>` tag — the accessibility
  // tree reports it as "button" by ROLE, which is what a getByRole()-style match sees, but a
  // plain `button` CSS tag selector matches nothing inside this iframe. `role=button` (the
  // Playwright ARIA-role selector engine, not a CSS tag) matches correctly.
  private readonly paypalSmartButtonSelector = 'role=button';
  private readonly paypalEmailFieldSelector = 'role=textbox[name="Email or mobile number"]';
  private readonly paypalNextButtonSelector = 'role=button[name="Next"]';
  private readonly paypalPasswordFieldSelector = 'role=textbox[name="Password"]';
  private readonly paypalLogInButtonSelector = 'role=button[name="Log In"]';
  private readonly paypalAgreeContinueTestIdSelector = '[data-testid="submit-button-initial"]';
  private readonly paypalAgreeContinueButtonSelector = 'role=button[name="Agree & Continue"]';
  private readonly orderSuccessUrlPattern = /\/ordersuccess/i;
  private readonly orderNumberTextPattern = /order number\s*([a-z0-9-]+)/i;

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

  // E2E-CHKOUT-002 / E2E-CHKOUT-003 — Locates the guest-section email input in the checkout
  // auth modal (i.e. near the "CONTINUE AS GUEST" button), optionally tagging it with
  // `targetAttr` so a caller can then fill it through a genuine Playwright locator. Pass ''
  // to probe without mutating the DOM. Tagging exists because a raw DOM `.value =` assignment
  // does not update React's controlled-input state — only a real CDP-level fill (dispatched
  // via this.elements.enterText) reliably triggers the onChange handler that CONTINUE AS GUEST
  // validation depends on.
  //
  // The scan widens outward from the guest CTA one ancestor level at a time but stops as soon
  // as it reaches a container that also carries a login-section signal (a visible password
  // input, or a visible button/submit matching loginSubmitPattern) — that container is treated
  // as the outer boundary between the guest and login sections, so the search never widens far
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
  private async findGuestEmailInput(targetAttr: string): Promise<boolean> {
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
                if (match) {
                  if (targetAttr) match.setAttribute(targetAttr, 'true');
                  return true;
                }
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
          targetAttr,
        },
      )
      .catch(() => false);
  }

  // E2E-CHKOUT-002 — Returns true if a visible, enabled email input is present in the guest
  // section of the checkout auth modal (i.e. near the "CONTINUE AS GUEST" button). Probe only:
  // passes an empty target attribute so the scan never mutates the DOM.
  async isGuestEmailFieldVisible(): Promise<boolean> {
    return this.findGuestEmailInput('');
  }

  // E2E-CHKOUT-003 — Fills the guest-section email input in the checkout auth modal with a
  // valid email and submits it via CONTINUE AS GUEST, advancing the flow from the auth modal
  // into the shipping address form. Callers must confirm the transition with
  // isOnShippingStep() before treating the shipping form as active (see that method's doc).
  // Returns whether the email input was found and filled — a false result means CONTINUE AS
  // GUEST was clicked against an empty field, per the file's fill-success policy (see
  // fillGuestShippingContactFields() below).
  async fillGuestEmailAndContinue(email: string): Promise<boolean> {
    const tagged = await this.findGuestEmailInput(this.guestEmailTargetAttr);
    if (tagged) {
      await this.elements.enterText(this.guestEmailTargetSelector, email);
    }
    await this.submitCurrentStep();
    return tagged;
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
            {
              headingSrc: this.shippingStepHeadingPattern.source,
              fieldSrc: this.shippingFieldAttrPattern.source,
            },
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
    await this.page.evaluate(
      ({ selector, pattern, flags }: { selector: string; pattern: string; flags: string }) => {
        const ctaRe = new RegExp(pattern, flags);
        const panels = Array.from(document.querySelectorAll(selector));
        for (const panel of panels) {
          const r = (panel as Element).getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = getComputedStyle(panel as Element);
          if (style.position !== 'fixed' && style.position !== 'absolute') continue;
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
      {
        selector: this.overlayPanelSelector,
        pattern: this.checkoutCtaTextPattern.source,
        flags: this.checkoutCtaTextPattern.flags,
      },
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
      { pattern: this.checkoutSubmitPattern.source, flags: this.checkoutSubmitPattern.flags },
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
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(
            ({ ariaSelector, textPattern }: { ariaSelector: string; textPattern: string }) => {
              const isVisibleWithText = (el: Element): boolean => {
                const text =
                  (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                if (!text) return false;
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              };

              // 1. ARIA-based signals (preferred — semantic and hash-safe)
              if (Array.from(document.querySelectorAll(ariaSelector)).some(isVisibleWithText)) {
                return true;
              }

              // 2. Plain-text validation messages (no ARIA role — e.g. "Please enter your email
              //    address." rendered in a plain div by Magento PWA checkout components).
              //    Pre-filter to elements whose text includes a validation keyword before
              //    applying the full regex, to avoid scanning thousands of DOM nodes.
              const re = new RegExp(textPattern, 'i');
              return Array.from(document.querySelectorAll('*')).some((el) => {
                if (el.children.length > 0) return false;
                const text =
                  (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                if (!text) return false;
                if (!/(please|required|must|invalid|cannot|blank)/i.test(text)) return false;
                return isVisibleWithText(el) && re.test(text);
              });
            },
            {
              ariaSelector: this.ariaValidationSelector,
              textPattern: this.validationTextPattern.source,
            },
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
    return this.page.evaluate(
      ({ ariaSelector, textPattern }: { ariaSelector: string; textPattern: string }) => {
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

        Array.from(document.querySelectorAll(ariaSelector)).forEach(addIfVisible);

        const re = new RegExp(textPattern, 'i');
        Array.from(document.querySelectorAll('*')).forEach((el) => {
          if (el.children.length > 0) return;
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
      { ariaSelector: this.ariaValidationSelector, textPattern: this.validationTextPattern.source },
    );
  }

  // E2E-CART-010 — Navigates directly to the /cart page. Used so callers can guarantee the
  // promo/discount field scan happens against /cart specifically, rather than relying on
  // isPromoCodeFieldVisible()'s Pass-1 scan of whatever surface (PDP, mini-cart overlay) is
  // currently loaded. Uses a relative URL to preserve the current storefront origin and SPA
  // session; isPromoCodeFieldVisible()'s Pass 2 reuses this method.
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
    // Pass 1: scan current page DOM (checkout step + any visible overlays).
    if (await this.scanForPromoField()) {
      return true;
    }

    // Pass 2: navigate to /cart and re-scan. Most Magento PWAs expose the promo field here
    // (typically an expandable "Have a promo code?" link).
    try {
      await this.navigateToCart();
      await this.waits
        .waitForCustomCondition(
          async () =>
            this.page
              .evaluate(() => document.body !== null && document.body.innerText.length > 0)
              .catch(() => false),
          { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
        )
        .catch(() => {});
      return await this.scanForPromoField();
    } catch {
      return false;
    }
  }

  // Internal helper: scans the current page DOM for a promo/discount code field. Pattern-
  // based scan (no CSS) — matches any visible text-input whose name/id/placeholder/aria-label
  // or associated label text matches the promo keyword pattern (promo|discount|coupon|voucher).
  // The Apply-button signal is a separate check — see hasApplyPromoButton().
  // Returns true as soon as either the attribute or the nearby-label signal matches. Never throws.
  //
  // E2E-CHKOUT-008 — `targetAttr`, when supplied, tags the matched input so applyPromoCode()
  // can fill it through a genuine Playwright locator, reusing the exact same attr+label
  // detection isPromoCodeFieldVisible() already relies on rather than a separate attr-only tag
  // (tagFieldByAttrPattern() alone would miss any storefront where the field is matched only by
  // its nearby label — see the class-level promo recon docblock's dual-signal strategy).
  private async scanForPromoField(targetAttr?: string): Promise<boolean> {
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.page.evaluate(
            ({ keywordSource, targetAttr }: { keywordSource: string; targetAttr: string | null }) => {
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
                if (!fieldAttrMatches(input) && !nearbyLabelMatches(input)) continue;
                if (targetAttr) input.setAttribute(targetAttr, 'true');
                return true;
              }
              return false;
            },
            { keywordSource: this.promoKeywordPattern.source, targetAttr: targetAttr ?? null },
          );
          return found;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return found;
  }

  // E2E-CHKOUT-008 — Shared predicate for the promo Apply button, parameterised on whether to
  // click the match: hasApplyPromoButton() calls it with click=false (pure visibility check),
  // applyPromoCode() calls it with click=true. Kept as one evaluate() so the button-matching
  // predicate is defined once rather than duplicated across a visibility check and a click scan.
  private async scanApplyPromoButton(click: boolean): Promise<boolean> {
    return this.page
      .evaluate(
        ({
          pattern,
          click,
          targetSelector,
        }: {
          pattern: string;
          click: boolean;
          targetSelector: string;
        }) => {
          const re = new RegExp(pattern, 'i');
          // Scope to the tagged promo input's own form/container so this scan cannot match an
          // unrelated "Apply" button elsewhere on the page (gift-card apply, filter apply, etc).
          // Falls back to document when the input isn't currently tagged (e.g. hasApplyPromoButton()
          // called standalone, without applyPromoCode()'s prior tagAndFillPromoField() call).
          const tagged = document.querySelector<HTMLElement>(targetSelector);
          const scope: ParentNode =
            tagged?.closest('form') ?? tagged?.parentElement?.parentElement ?? document;
          const btns = Array.from(
            scope.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
          );
          const target = btns.find((btn) => {
            if (btn.disabled) return false;
            const text = ((btn as HTMLElement).innerText ?? btn.value ?? btn.textContent ?? '').trim();
            if (!re.test(text)) return false;
            const r = btn.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const style = getComputedStyle(btn);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
            return true;
          });
          if (!target) return false;
          if (click) target.click();
          return true;
        },
        {
          pattern: this.promoApplyButtonPattern.source,
          click,
          targetSelector: this.promoCodeTargetSelector,
        },
      )
      .catch(() => false);
  }

  // E2E-CART-010 (recommended secondary check) — Returns true if an "Apply promo/discount/
  // coupon/voucher code" button is visible at the current checkout entry point. Kept separate
  // from isPromoCodeFieldVisible() (which scans only for the input) so callers can split the
  // promo-input and apply-button assertions.
  async hasApplyPromoButton(): Promise<boolean> {
    return this.scanApplyPromoButton(false);
  }

  // E2E-CHKOUT-008 / E2E-ERR-004 — Tags the promo/discount input (same dual attr+label signal
  // as isPromoCodeFieldVisible()) then fills it with `code` through a genuine Playwright
  // locator. Retries the tag->fill sequence up to `maxAttempts` times: /cart's totals refresh
  // can trigger a re-render between tag and fill, the same race tagAndFillField() recovers from
  // elsewhere in this file (a raw DOM value assignment does not update React's controlled-input
  // state, so a genuine locator fill is required either way). tagAndFillField() itself is
  // attr-only and cannot be reused directly without losing the nearby-label match signal.
  private async tagAndFillPromoField(code: string, maxAttempts = 2): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tagged = await this.scanForPromoField(this.promoCodeTargetAttr);
      if (!tagged) return false;
      try {
        await this.elements.enterText(this.promoCodeTargetSelector, code);
        return true;
      } catch {
        // Field vanished between tag and fill (re-render race) — loop retags fresh DOM state.
      }
    }
    return false;
  }

  // E2E-CHKOUT-008 / E2E-ERR-004 — Fills the promo/discount field with `code` and clicks Apply.
  // Returns false (never throws) if the field could not be tagged/filled or the Apply button
  // could not be located — distinct from "no rejection message appeared", so callers can tell
  // "code was never actually submitted" apart from "code was submitted and accepted".
  async applyPromoCode(code: string): Promise<boolean> {
    const filled = await this.tagAndFillPromoField(code);
    if (!filled) return false;
    return this.scanApplyPromoButton(true);
  }

  // E2E-CHKOUT-008 / E2E-ERR-004 — Scans for a visible promo-code rejection message: ARIA
  // signals first ([role="alert"], [aria-live]), then a text-pattern fallback — both tiers
  // require the candidate text to match BOTH promoCodeErrorTextPattern (rejection vocabulary)
  // AND promoErrorContextPattern (promo/coupon context). The ARIA tier is a LOCATION signal
  // only (any live region on a /cart page can hold unrelated visible text — cart-status
  // toasts, item-count announcements — so visible-text-alone would make this vacuously true);
  // the content check is what actually confirms the element is a coupon rejection. Polls for
  // DIALOG_APPEAR to allow the rejection response to render. Never throws.
  // `code` is the exact string that was submitted (see PromoCodes.invalidCode) — Magento's
  // actual rejection copy echoes it back verbatim (`"<code>" is invalid...`), which is a
  // strictly tighter context signal than promoErrorContextPattern's generic vocabulary (see
  // that field's docblock). Compared via plain substring `includes()`, never interpolated into
  // a RegExp, so a future code containing regex metacharacters cannot change match semantics.
  private async scanForPromoCodeError(code: string): Promise<string | null> {
    let message: string | null = null;
    await this.waits
      .waitForCustomCondition(
        async () => {
          message = await this.page.evaluate(
            ({
              ariaSelector,
              textPattern,
              contextPattern,
              code,
            }: {
              ariaSelector: string;
              textPattern: string;
              contextPattern: string;
              code: string;
            }) => {
              const errorRe = new RegExp(textPattern, 'i');
              const contextRe = new RegExp(contextPattern, 'i');
              const codeLower = code.toLowerCase();
              const isPromoError = (text: string): boolean =>
                errorRe.test(text) && (text.toLowerCase().includes(codeLower) || contextRe.test(text));

              const visibleText = (el: Element): string => {
                const text = (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim();
                if (!text) return '';
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 ? text : '';
              };

              for (const el of Array.from(document.querySelectorAll(ariaSelector))) {
                const text = visibleText(el);
                if (text && isPromoError(text)) return text;
              }

              for (const el of Array.from(document.querySelectorAll('*'))) {
                if (el.children.length > 0) continue;
                const text = visibleText(el);
                if (text && isPromoError(text)) return text;
              }
              return null;
            },
            {
              ariaSelector: this.ariaValidationSelector,
              textPattern: this.promoCodeErrorTextPattern.source,
              contextPattern: this.promoErrorContextPattern.source,
              code,
            },
          );
          return message !== null;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return message;
  }

  // E2E-CHKOUT-008 / E2E-ERR-004 — Returns the visible rejection message text, or null if none
  // is found. `code` must be the exact string submitted via applyPromoCode() — required, not
  // optional, because it is the primary context signal the scan relies on (see
  // scanForPromoCodeError()'s docblock).
  async getPromoCodeErrorMessage(code: string): Promise<string | null> {
    return this.scanForPromoCodeError(code);
  }

  // E2E-CHKOUT-004 — Generic version of findGuestEmailInput(): tags the first visible, enabled
  // input whose name/id/placeholder/aria-label matches `pattern` with `targetAttr`, so callers
  // can fill it through a genuine Playwright locator (a raw DOM value assignment does not
  // update React's controlled-input state). Unlike findGuestEmailInput(), no login-boundary
  // scoping is needed — the shipping form has no competing sibling field of the same type.
  // Returns false (never throws) if no matching field is found.
  private async tagFieldByAttrPattern(pattern: RegExp, targetAttr: string): Promise<boolean> {
    return this.page
      .evaluate(
        ({ patternSrc, targetAttr }: { patternSrc: string; targetAttr: string }) => {
          const re = new RegExp(patternSrc, 'i');
          const isVisible = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
          const match = inputs.find((input) => {
            if (!isVisible(input) || input.disabled) return false;
            const attrs = ['name', 'id', 'placeholder', 'aria-label'];
            return attrs.some((a) => {
              const v = input.getAttribute(a) ?? '';
              return v !== '' && re.test(v);
            });
          });
          if (!match) return false;
          match.setAttribute(targetAttr, 'true');
          return true;
        },
        { patternSrc: pattern.source, targetAttr },
      )
      .catch(() => false);
  }

  // E2E-CHKOUT-004 — RECON FINDING (confirmed live, Platypus AU staging, single-worker run):
  // tagging a field then filling it as two separate steps (tagFieldByAttrPattern() followed by
  // elements.enterText()'s own waitForSelector) has a race window — filling one field can
  // trigger a debounced validation/re-render that replaces a SIBLING field's DOM node between
  // the moment it was tagged and the moment the following Playwright command queries for that
  // same tag, so the tag "vanishes" and the wait times out even though a visually-identical
  // field is on screen a moment later. tagAndFillField() recovers from this by re-tagging (a
  // fresh DOM scan) before every attempt rather than tagging once and hoping the node survives.
  private async tagAndFillField(
    pattern: RegExp,
    targetAttr: string,
    targetSelector: string,
    value: string,
    maxAttempts = 2,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tagged = await this.tagFieldByAttrPattern(pattern, targetAttr);
      if (!tagged) return false;
      try {
        await this.elements.enterText(targetSelector, value);
        return true;
      } catch {
        // Field vanished between tag and fill (re-render race) — loop retags fresh DOM state.
      }
    }
    return false;
  }

  // E2E-PLAORD-001 — RECON FINDING (confirmed live, all 8 GRA storefronts via a fixture-based
  // throwaway recon spec that reused fillGuestShippingContactFields/tagFieldByAttrPattern): after
  // tagging a field with tagFieldByAttrPattern(), the tag does not survive to the next field's
  // fill — filling firstName then lastName then phoneNumber in a single pass left ONLY
  // phoneNumber (the last field filled) holding its value; firstName/lastName read back empty
  // even on Vans AU, a storefront where the rest of the flow (and this test) otherwise passes.
  // Re-tagging via tagFieldByAttrPattern() itself (rather than querying the stale target
  // attribute) is what makes a fresh read reliable here, mirroring tagAndFillField()'s own
  // re-tag-before-every-attempt rationale. Returns null if the field cannot be located at all.
  private async readTaggedFieldValue(
    pattern: RegExp,
    targetAttr: string,
    targetSelector: string,
  ): Promise<string | null> {
    const tagged = await this.tagFieldByAttrPattern(pattern, targetAttr);
    if (!tagged) return null;
    return this.page
      .evaluate((selector: string) => {
        const el = document.querySelector<HTMLInputElement>(selector);
        return el ? el.value : null;
      }, targetSelector)
      .catch(() => null);
  }

  // E2E-CHKOUT-004 / E2E-PLAORD-001 — Fills the shipping form's firstName/lastName/phoneNumber
  // contact fields (NOT the address field — see fillShippingAddressAndSelectSuggestion() for
  // that). Settles in rounds rather than a single fill-once pass: each round re-reads every
  // field's CURRENT value (via a fresh tagFieldByAttrPattern re-tag, not the previous round's
  // selector, which may point at an already-remounted node) and re-fills only the fields that
  // don't yet hold their intended value, so a field wiped by a sibling's fill in the same round
  // gets corrected on the next. Returns true once every field holds its intended value, or false
  // if maxRounds is exhausted first — a false return means the form is NOT reliably filled and
  // must be surfaced by the caller (fillGuestShippingAddress() reports it as
  // GuestShippingFillResult.contactFieldsSettled), never discarded.
  private async fillGuestShippingContactFields(
    data: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
    },
    maxRounds = 4,
  ): Promise<boolean> {
    const fields = [
      {
        pattern: this.shippingFirstNameFieldPattern,
        targetAttr: this.shippingFirstNameTargetAttr,
        targetSelector: this.shippingFirstNameTargetSelector,
        value: data.firstName,
      },
      {
        pattern: this.shippingLastNameFieldPattern,
        targetAttr: this.shippingLastNameTargetAttr,
        targetSelector: this.shippingLastNameTargetSelector,
        value: data.lastName,
      },
      {
        pattern: this.shippingPhoneFieldPattern,
        targetAttr: this.shippingPhoneTargetAttr,
        targetSelector: this.shippingPhoneTargetSelector,
        value: data.phoneNumber,
      },
    ];

    for (let round = 0; round < maxRounds; round++) {
      let allSettled = true;
      for (const field of fields) {
        const currentValue = await this.readTaggedFieldValue(field.pattern, field.targetAttr, field.targetSelector);
        if (currentValue === field.value) continue;
        allSettled = false;
        await this.tagAndFillField(field.pattern, field.targetAttr, field.targetSelector, field.value);
      }
      if (allSettled) return true;
    }
    return false;
  }

  // E2E-CHKOUT-004 — Clicks the first rendered address-suggestion element below the tagged
  // address input. Suggestions are plain sibling elements (hashed class names, no
  // role="option"/listbox semantics — see class-level recon docblock) identified generically
  // as: a leaf element (no children), visible, containing a comma (the storefront's formatted
  // "street, suburb, state, postcode" pattern), positioned at/below the input's bottom edge,
  // and NOT the "Hang tight, we are finding the best option" loading placeholder (which also
  // contains a comma and would otherwise false-match). Returns false if no candidate is found.
  private async clickFirstAddressSuggestion(): Promise<boolean> {
    return this.page
      .evaluate(
        ({ selector, loadingSrc }: { selector: string; loadingSrc: string }) => {
          const input = document.querySelector(selector);
          if (!input) return false;
          const loadingRe = new RegExp(loadingSrc, 'i');
          const inputRect = input.getBoundingClientRect();
          const isVisible = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const candidates = Array.from(document.querySelectorAll('*')).filter((el) => {
            if (el.children.length > 0 || el === input) return false;
            const text = (el as HTMLElement).innerText?.trim() ?? '';
            if (!text || text.length < 8 || text.length > 150 || !text.includes(',')) return false;
            if (loadingRe.test(text)) return false;
            if (!isVisible(el)) return false;
            return el.getBoundingClientRect().top >= inputRect.bottom - 5;
          });
          if (candidates.length === 0) return false;
          candidates.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
          (candidates[0] as HTMLElement).click();
          return true;
        },
        {
          selector: this.shippingAddressTargetSelector,
          loadingSrc: this.shippingMethodsLoadingTextPattern.source,
        },
      )
      .catch(() => false);
  }

  // E2E-CHKOUT-004 — Tags the address input, types `addressQuery` as real per-character
  // keystrokes (required to trigger the debounced suggestion lookup — see class-level recon
  // docblock), then polls for and clicks the first rendered suggestion. Retries the whole
  // tag->type->wait-for-suggestion sequence up to `maxAttempts` times: (a) recovers from the
  // same tag/re-render race documented on tagAndFillField() — filling the preceding contact
  // fields can trigger a validation re-render that replaces the address input between tag and
  // type; (b) doubles as the "no suggestion rendered" fallback — confirmed live across all 8
  // storefronts that NONE expose discrete suburb/postcode/city inputs to fall back to (a single
  // fullAddress field, backed by autocomplete, is the only address surface everywhere), so a
  // fresh retry of the debounced lookup is the only meaningful fallback when a storefront's
  // autocomplete does not return a suggestion for the first attempt (observed on Vans AU).
  // Returns true only if a suggestion was actually clicked; the shipping-method radios are
  // confirmed to stay disabled when the address is left as free/uncommitted text, so callers
  // must treat a false return as "cannot proceed" after exhausting retries.
  async fillShippingAddressAndSelectSuggestion(addressQuery: string, maxAttempts = 2): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tagged = await this.tagFieldByAttrPattern(this.shippingAddressFieldPattern, this.shippingAddressTargetAttr);
      if (!tagged) return false;

      try {
        await this.elements.clearAndTypeSequentially(this.shippingAddressTargetSelector, addressQuery);
      } catch {
        continue;
      }

      let suggestionSelected = false;
      await this.waits
        .waitForCustomCondition(
          async () => {
            suggestionSelected = await this.clickFirstAddressSuggestion();
            return suggestionSelected;
          },
          { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
        )
        .catch(() => {});
      if (suggestionSelected) return true;
    }
    return false;
  }

  // E2E-CHKOUT-004 — RECON FINDING (confirmed live, single-worker comparison): isOnShippingStep()
  // can return true on a heading-only match ("CHECKING OUT AS GUEST" / "DELIVER TO") before the
  // address-autocomplete widget has actually hydrated. Starting to type into the address field at
  // that moment still returns a "suggestion selected" result, but the address never truly commits
  // server-side, so the shipping-rate recalculation never fires and every delivery-method radio
  // stays disabled — getSelectableShippingMethodCount() then reads 0 even after the full
  // NETWORK_IDLE_SLOW readiness wait. Polling for the fullAddress-pattern field to be present AND
  // visible before starting to fill anything closes this race. Best-effort — falls through on
  // timeout so the caller's own precondition checks remain the source of truth.
  async waitForShippingFormReady(): Promise<void> {
    await this.waits
      .waitForCustomCondition(
        async () =>
          this.page
            .evaluate((patternSrc: string) => {
              const re = new RegExp(patternSrc, 'i');
              const isVisible = (el: Element): boolean => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              };
              return Array.from(document.querySelectorAll<HTMLInputElement>('input')).some((input) => {
                if (!isVisible(input) || input.disabled) return false;
                const attrs = ['name', 'id', 'placeholder', 'aria-label'];
                return attrs.some((a) => {
                  const v = input.getAttribute(a) ?? '';
                  return v !== '' && re.test(v);
                });
              });
            }, this.shippingAddressFieldPattern.source)
            .catch(() => false),
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
  }

  // E2E-CHKOUT-004 — Fills the full guest shipping form (contact fields + address) and reports
  // both outcomes separately (see GuestShippingFillResult). `addressSelected` is false when the
  // address field could not be located or no suggestion could be selected for
  // `data.addressQuery`; `contactFieldsSettled` is false when the contact settle loop exhausted
  // its rounds. Callers must test.skip() on either rather than proceeding to shipping-method
  // checks — an unsettled contact field surfaces downstream as a disabled CONTINUE TO PAYMENT,
  // which reads as an app defect rather than the fill problem it actually is.
  //
  // E2E-PLAORD-001 — RECON FINDING (confirmed live): committing the address suggestion can
  // itself trigger a further re-render that reverts the contact fields filled just before it
  // (same sibling-remount behaviour documented on fillGuestShippingContactFields()). Re-running
  // the contact-field settle loop after a successful address commit corrects that without
  // re-running the address step itself.
  async fillGuestShippingAddress(data: GuestShippingAddress): Promise<GuestShippingFillResult> {
    await this.waitForShippingFormReady();
    let contactFieldsSettled = await this.fillGuestShippingContactFields(data);

    const addressSelected = await this.fillShippingAddressAndSelectSuggestion(data.addressQuery);
    if (!addressSelected) {
      return { addressSelected: false, contactFieldsSettled, addressStillFilled: false };
    }

    contactFieldsSettled = await this.fillGuestShippingContactFields(data);

    const addressValue = await this.readTaggedFieldValue(
      this.shippingAddressFieldPattern,
      this.shippingAddressTargetAttr,
      this.shippingAddressTargetSelector,
    );
    return {
      addressSelected,
      contactFieldsSettled,
      addressStillFilled: (addressValue ?? '').trim() !== '',
    };
  }

  // E2E-CHKOUT-004 — Waits (best-effort) until the delivery-method list has actually finished
  // recalculating after an address is committed. Radios are present-but-disabled from the very
  // first render (see class-level recon docblock), so polling for "a radio is visible" resolves
  // instantly and races ahead of the rate-recalculation — confirmed live: without gating on the
  // ENABLED state, getSelectableShippingMethodCount() read 0 immediately afterward on Platypus
  // AU even though exactly one method reliably becomes enabled moments later. Polls for at
  // least one visible, non-disabled radio (the same condition getSelectableShippingMethodCount()
  // itself checks).
  //
  // Additionally requires the enabled-radio COUNT to be stable across two consecutive polls
  // (spaced by POLL_INTERVAL_NORMAL) before returning — confirmed live on Dr. Martens AU that the
  // delivery-method list can briefly remount to zero radios in the moment right after appearing
  // enabled (a component re-render, not a genuine change in availability), which let a caller's
  // immediate follow-up query race ahead and read an empty list a beat later. This debounce/settle
  // pattern (not a fixed sleep — it re-polls the DOM each cycle) filters that flicker out so
  // callers observe a genuinely settled, interactive list.
  async waitForShippingMethodsReady(): Promise<void> {
    let lastCount = -1;
    let stableReads = 0;
    await this.waits
      .waitForCustomCondition(
        async () => {
          const count = await this.getSelectableShippingMethodCount();
          if (count > 0 && count === lastCount) {
            stableReads++;
          } else {
            stableReads = 0;
            lastCount = count;
          }
          return stableReads >= 1;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
  }

  // E2E-CHKOUT-004 — Returns the number of visible, non-disabled shipping-method radio
  // inputs. A method that is disabled is not user-selectable (see class-level recon docblock —
  // an uncommitted/unmatched address leaves methods disabled), so disabled radios are excluded
  // from the count callers use to decide whether a method-switch assertion is meaningful.
  async getSelectableShippingMethodCount(): Promise<number> {
    return this.page
      .evaluate(() => {
        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
          (el) => isVisible(el) && !el.disabled,
        ).length;
      })
      .catch(() => 0);
  }

  // E2E-CHKOUT-004 — Captures a forensic snapshot for a getSelectableShippingMethodCount()===0
  // reading. Distinguishes three previously-conflated causes: no radios in the DOM at all
  // (backend never returned rates), radios present but still disabled (recalculation stalled or
  // still in flight), and the "Hang tight..." loading placeholder still showing (still loading,
  // not stalled). Also re-reads the committed address, since a caller reaching this point has
  // already committed one earlier — if it now reads empty, the address was lost by a later
  // re-render rather than the shipping-rate call ever failing. `pageText` is capped to keep the
  // attachment readable; it is a debugging aid, not something any assertion parses.
  async captureShippingMethodDiagnostics(): Promise<ShippingMethodDiagnostics> {
    const domSnapshot = await this.page
      .evaluate((loadingSrc: string) => {
        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
        const loadingRe = new RegExp(loadingSrc, 'i');
        return {
          totalRadioCount: radios.length,
          enabledRadioCount: radios.filter((el) => !el.disabled).length,
          visibleRadioCount: radios.filter((el) => isVisible(el)).length,
          loadingTextVisible: loadingRe.test(document.body.innerText),
          pageText: document.body.innerText.slice(0, 4000),
        };
      }, this.shippingMethodsLoadingTextPattern.source)
      .catch(() => ({
        totalRadioCount: -1,
        enabledRadioCount: -1,
        visibleRadioCount: -1,
        loadingTextVisible: false,
        pageText: '(page snapshot failed)',
      }));

    const committedAddressValue = await this.readTaggedFieldValue(
      this.shippingAddressFieldPattern,
      this.shippingAddressTargetAttr,
      this.shippingAddressTargetSelector,
    );

    return { ...domSnapshot, committedAddressValue };
  }

  // E2E-CHKOUT-004 — Returns true if a shipping method already arrived pre-selected (some
  // storefronts auto-select a default carrier once the address is committed, rather than
  // requiring an explicit user click). Two-part check: (1) a visible, checked radio — the
  // direct, parse-independent signal; (2) fallback to a non-zero parsed delivery line, for the
  // rare case a storefront reflects the selection in the order summary before the radio's
  // `checked` property is queryable in the same tick. Never throws.
  async isAnyShippingMethodSelected(): Promise<boolean> {
    const radioChecked = await this.page
      .evaluate(() => {
        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).some(
          (el) => isVisible(el) && el.checked,
        );
      })
      .catch(() => false);
    if (radioChecked) return true;
    const totals = await this.getOrderSummaryTotals();
    return totals.delivery !== null && totals.delivery > 0;
  }

  // E2E-CHKOUT-004 — RECON FINDING (confirmed live, Skechers AU staging): a storefront's
  // auto-selection of a default carrier (e.g. "Free Express Delivery", $0.00) can commit
  // slightly AFTER its radio first becomes enabled/visible — waitForShippingMethodsReady()
  // resolves as soon as an enabled radio exists, which can race ahead of the auto-select commit
  // and cause isAnyShippingMethodSelected() to read false a moment too early. Selecting index 0
  // in that false-negative window silently "re-selects" the already-checked free method (no
  // totals change, and callers wrongly conclude the app is broken). This polls
  // isAnyShippingMethodSelected() until it reads the SAME value on two consecutive checks
  // (spaced by POLL_INTERVAL_FAST) — a debounce/settle gate, not a fixed sleep — so callers
  // snapshot pre-selection state only once it has stopped changing. Best-effort: falls through
  // (returns) on timeout so the caller's own read is still the source of truth.
  async waitForShippingSelectionSettled(): Promise<void> {
    let lastState: boolean | null = null;
    let stableReads = 0;
    await this.waits
      .waitForCustomCondition(
        async () => {
          const current = await this.isAnyShippingMethodSelected();
          if (current === lastState) {
            stableReads++;
          } else {
            stableReads = 0;
            lastState = current;
          }
          return stableReads >= 2;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
  }

  // E2E-CHKOUT-004 — Returns the index (within the same visible/non-disabled radio list that
  // selectNthEnabledShippingMethod() and getSelectableShippingMethodCount() operate on) of the
  // currently checked shipping method, or -1 if none is checked. Used to compute an "alternate"
  // index that is guaranteed to differ from whatever is already selected.
  async getCheckedShippingMethodIndex(): Promise<number> {
    return this.page
      .evaluate(() => {
        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
          (el) => isVisible(el) && !el.disabled,
        );
        return radios.findIndex((el) => el.checked);
      })
      .catch(() => -1);
  }

  // E2E-CHKOUT-004 — Clicks the `index`-th visible, non-disabled shipping-method radio's
  // wrapping <label> (confirmed live: the <label> — not the disabled-by-default <input>
  // itself — is the reliable click target that toggles `checked` once the radio is enabled).
  // Returns false if no enabled radio exists at that index.
  async selectNthEnabledShippingMethod(index: number): Promise<boolean> {
    return this.page
      .evaluate((idx: number) => {
        const isVisible = (el: Element): boolean => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
          (el) => isVisible(el) && !el.disabled,
        );
        const target = radios[idx];
        if (!target) return false;
        let ancestor: Element | null = target.parentElement;
        for (let depth = 0; depth < 6 && ancestor; depth++) {
          if (ancestor.tagName === 'LABEL') {
            (ancestor as HTMLElement).click();
            return true;
          }
          ancestor = ancestor.parentElement;
        }
        target.click();
        return true;
      }, index)
      .catch(() => false);
  }

  // E2E-CHKOUT-004 — Reads Subtotal/shipping-cost/Total from the "ORDER SUMMARY" panel via a
  // body-innerText scan, scoped to text from the "ORDER SUMMARY" heading onward. The
  // shipping-cost line's LABEL is not stable (reads "Delivery" before any method is selected,
  // then flips to the selected method's own label, e.g. "Fixed" — confirmed live), so the
  // shipping cost is read POSITIONALLY: the first price token that appears strictly between
  // the subtotal's price and the "Total" label. Returns null for any value that cannot be
  // parsed. Never throws.
  async getOrderSummaryTotals(): Promise<OrderSummaryTotals> {
    const orderSummaryHeading = this.orderSummaryHeadingPattern.source;
    const subtotalLabel = this.summarySubtotalLabelPattern.source;
    const totalLabel = this.summaryTotalLabelPattern.source;
    const priceToken = this.summaryPriceTokenPattern.source;
    const discountToken = this.summaryDiscountTokenPattern.source;

    return this.page
      .evaluate(
        ({
          orderSummaryHeading,
          subtotalLabel,
          totalLabel,
          priceToken,
          discountToken,
        }: {
          orderSummaryHeading: string;
          subtotalLabel: string;
          totalLabel: string;
          priceToken: string;
          discountToken: string;
        }) => {
          const headingRe = new RegExp(orderSummaryHeading, 'i');
          const subtotalRe = new RegExp(subtotalLabel, 'i');
          const totalRe = new RegExp(totalLabel, 'i');
          const priceRe = new RegExp(priceToken);
          const discountRe = new RegExp(discountToken);

          const lines = document.body.innerText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          const startIdx = lines.findIndex((l) => headingRe.test(l));
          const scoped = startIdx === -1 ? lines : lines.slice(startIdx);

          const parsePrice = (token: string): number => Number(token.replace(/[^0-9.]/g, ''));

          const subtotalLabelIdx = scoped.findIndex((l) => subtotalRe.test(l));
          let subtotalPriceIdx = -1;
          let subtotal: number | null = null;
          if (subtotalLabelIdx !== -1) {
            for (let j = subtotalLabelIdx + 1; j < Math.min(subtotalLabelIdx + 4, scoped.length); j++) {
              if (priceRe.test(scoped[j])) {
                subtotal = parsePrice(scoped[j]);
                subtotalPriceIdx = j;
                break;
              }
            }
          }

          const totalLabelIdx = scoped.findIndex(
            (l, i) => (subtotalLabelIdx === -1 || i > subtotalLabelIdx) && totalRe.test(l),
          );
          let total: number | null = null;
          if (totalLabelIdx !== -1) {
            for (let j = totalLabelIdx + 1; j < Math.min(totalLabelIdx + 4, scoped.length); j++) {
              if (priceRe.test(scoped[j])) {
                total = parsePrice(scoped[j]);
                break;
              }
            }
          }

          let delivery: number | null = null;
          if (subtotalPriceIdx !== -1 && totalLabelIdx !== -1) {
            for (let j = subtotalPriceIdx + 1; j < totalLabelIdx; j++) {
              if (priceRe.test(scoped[j])) {
                delivery = parsePrice(scoped[j]);
                break;
              }
            }
          }

          // Sums ALL negative-token discount/promotion lines between subtotal and total (not
          // just the first) — parsePrice() strips the leading "-" along with the "$", so the
          // negation is re-applied explicitly here to keep the value genuinely negative for
          // callers reconstructing total = subtotal + delivery + discount.
          let discount: number | null = null;
          if (subtotalPriceIdx !== -1 && totalLabelIdx !== -1) {
            for (let j = subtotalPriceIdx + 1; j < totalLabelIdx; j++) {
              if (discountRe.test(scoped[j])) {
                discount = (discount ?? 0) - parsePrice(scoped[j]);
              }
            }
          }

          return { subtotal, delivery, total, discount };
        },
        { orderSummaryHeading, subtotalLabel, totalLabel, priceToken, discountToken },
      )
      .catch(() => ({ subtotal: null, delivery: null, total: null, discount: null }));
  }

  // E2E-CHKOUT-006 — Reads product name + quantity + price for each line item rendered in the
  // "ORDER SUMMARY" panel's "<N> ITEM(S)" list (see the recon docblock above
  // orderReviewItemsHeaderPattern). Uses the same body-innerText scan + positional-parse
  // strategy as getOrderSummaryTotals(): scopes to the "ORDER SUMMARY" heading onward, locates
  // the "<N> ITEM(S)" header line, then walks forward collecting lines into a buffer (skipping
  // "Edit" links) until a "Qty: <n>" line is hit — the buffer becomes that item's `name`, and
  // the first price-token line found within the next 2 lines after "Qty:" becomes its `price`.
  // Stops once the header's declared item count has been read, so unrelated marketing copy
  // rendered below the list (e.g. loyalty-program promos, confirmed present on Platypus AU) is
  // never absorbed as a phantom extra item. Returns an empty array if no item list is found.
  // Never throws.
  async getOrderReviewLineItems(): Promise<OrderReviewLineItem[]> {
    const orderSummaryHeading = this.orderSummaryHeadingPattern.source;
    const itemsHeaderPattern = this.orderReviewItemsHeaderPattern.source;
    const editLinePattern = this.orderReviewEditLinePattern.source;
    const qtyLinePattern = this.orderReviewQtyLinePattern.source;
    const priceToken = this.summaryPriceTokenPattern.source;

    return this.page
      .evaluate(
        ({
          orderSummaryHeading,
          itemsHeaderPattern,
          editLinePattern,
          qtyLinePattern,
          priceToken,
        }: {
          orderSummaryHeading: string;
          itemsHeaderPattern: string;
          editLinePattern: string;
          qtyLinePattern: string;
          priceToken: string;
        }) => {
          const headingRe = new RegExp(orderSummaryHeading, 'i');
          const itemsHeaderRe = new RegExp(itemsHeaderPattern, 'i');
          const editRe = new RegExp(editLinePattern, 'i');
          const qtyRe = new RegExp(qtyLinePattern, 'i');
          const priceRe = new RegExp(priceToken);

          const lines = document.body.innerText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          const startIdx = lines.findIndex((l) => headingRe.test(l));
          const scoped = startIdx === -1 ? lines : lines.slice(startIdx);

          const parsePrice = (token: string): number => Number(token.replace(/[^0-9.]/g, ''));

          const headerIdx = scoped.findIndex((l) => itemsHeaderRe.test(l));
          if (headerIdx === -1) return [];

          const countMatch = scoped[headerIdx].match(/\d+/);
          const itemCount = countMatch ? Number(countMatch[0]) : 0;

          const items: { name: string; quantity: number; price: number | null }[] = [];
          let buffer: string[] = [];
          let idx = headerIdx + 1;
          while (idx < scoped.length && items.length < itemCount) {
            const line = scoped[idx];
            if (editRe.test(line)) {
              idx++;
              continue;
            }
            if (qtyRe.test(line)) {
              const qtyMatch = line.match(/\d+/);
              const quantity = qtyMatch ? Number(qtyMatch[0]) : 0;
              let price: number | null = null;
              let consumed = idx + 1;
              for (let k = idx + 1; k < Math.min(idx + 3, scoped.length); k++) {
                if (priceRe.test(scoped[k])) {
                  price = parsePrice(scoped[k]);
                  consumed = k + 1;
                  break;
                }
              }
              items.push({ name: buffer.join(' ').trim(), quantity, price });
              buffer = [];
              idx = consumed;
              continue;
            }
            buffer.push(line);
            idx++;
          }
          return items;
        },
        { orderSummaryHeading, itemsHeaderPattern, editLinePattern, qtyLinePattern, priceToken },
      )
      .catch(() => []);
  }

  // E2E-CHKOUT-004 — Polls getOrderSummaryTotals() until `field` (default 'total') differs from
  // `previousValue` or the timeout elapses, then returns the latest read totals. Used after
  // selecting a shipping method so callers assert against a settled recalculation instead of a
  // fixed sleep. If the value never changes within the timeout, the returned (unchanged) totals
  // are themselves the accurate negative signal for the caller's assertion.
  //
  // The `field` parameter exists because 'total' is not reliable on every storefront: some
  // render an extra discount/member-price line inside the order summary panel that the
  // positional parse in getOrderSummaryTotals() can pick up instead of the genuine grand total
  // (observed live on Vans AU staging — a parsed total lower than the parsed subtotal). The
  // 'delivery' line does not sit near any discount line and has proven reliable everywhere it
  // was checked — callers with a reason to distrust 'total' on a given storefront should pass
  // 'delivery' instead.
  async waitForOrderSummaryTotalChange(
    previousValue: number | null,
    field: 'total' | 'delivery' = 'total',
  ): Promise<OrderSummaryTotals> {
    let latest: OrderSummaryTotals = { subtotal: null, delivery: null, total: null, discount: null };
    await this.waits
      .waitForCustomCondition(
        async () => {
          latest = await this.getOrderSummaryTotals();
          return latest[field] !== null && latest[field] !== previousValue;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
    return latest;
  }

  // E2E-PLAORD-001 — Polls (best-effort) until CONTINUE TO PAYMENT is enabled. See the
  // continueToPaymentButtonSelector recon docblock for why this is a separate wait from
  // confirming a shipping-method radio is checked, rather than assuming the two are
  // simultaneous.
  async waitForContinueToPaymentEnabled(): Promise<void> {
    await this.waits
      .waitForCustomCondition(() => this.elements.isElementEnabled(this.continueToPaymentButtonSelector), {
        timeout: TIMEOUTS.NETWORK_IDLE_SLOW,
        interval: TIMEOUTS.POLL_INTERVAL_NORMAL,
      })
      .catch(() => {});
  }

  // E2E-PLAORD-001 — Returns true once the payment step's method-selection radios are visible
  // (see the class-level PayPal recon docblock). Callers should gate on this after clicking
  // CONTINUE TO PAYMENT (via submitCurrentStep(), already matched by checkoutSubmitPattern's
  // "continue") before attempting selectPayPalPaymentMethod().
  async isOnPaymentStep(): Promise<boolean> {
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = await this.elements.isElementDisplayed(this.braintreePaypalRadioSelector);
          return found;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
    return found;
  }

  // E2E-PLAORD-001 — Selects the "PayPal" payment method radio (see class-level recon
  // docblock for why the value-attribute selector is used instead of an accessible-name
  // match). Selecting it renders the PayPal Smart Button iframe — callers must follow with
  // waitForPayPalSmartButtonReady() before attempting to click it.
  async selectPayPalPaymentMethod(): Promise<void> {
    await this.elements.clickElement(this.braintreePaypalRadioSelector);
  }

  // E2E-PLAORD-001 — Polls (best-effort) until the PayPal Smart Button iframe has hydrated and
  // its button is visible. The SDK loads and renders this asynchronously after the radio is
  // selected, so a fixed-timing click would race ahead of it.
  async waitForPayPalSmartButtonReady(): Promise<void> {
    await this.waits
      .waitForCustomCondition(
        () => this.frames.isVisible(this.paypalSmartButtonFrameSelector, this.paypalSmartButtonSelector),
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
  }

  // E2E-PLAORD-001 — Clicks the PayPal Smart Button inside its cross-origin iframe. Must use
  // this.frames (FrameHelper / frameLocator) rather than page.evaluate() — see class-level
  // recon docblock for why the iframe's content is unreachable from page-script context.
  // Composes frameLocator + .first() + elements.clickLocator() rather than FrameHelper.click()
  // directly, since the latter has no .first() and would throw a strict-mode error if the SDK
  // ever renders more than one <button> inside this iframe. Returns false (never throws) if
  // the button could not be located/clicked.
  private async clickPayPalSmartButton(): Promise<boolean> {
    try {
      const buttonLocator = this.frames
        .locator(this.paypalSmartButtonFrameSelector)
        .locator(this.paypalSmartButtonSelector)
        .first();
      await this.elements.clickLocator(buttonLocator);
      return true;
    } catch {
      return false;
    }
  }

  // E2E-PLAORD-001 — Resolves whichever of the two confirmed "Agree & Continue" selectors is
  // currently visible: the testid (primary — see class-level recon docblock) or the role-name
  // fallback. Returns null if neither is visible.
  private async resolveAgreeContinueSelector(): Promise<string | null> {
    return this.dom.firstVisible([this.paypalAgreeContinueTestIdSelector, this.paypalAgreeContinueButtonSelector]);
  }

  // E2E-PLAORD-001 — Detects which of the two confirmed popup states is currently showing (see
  // class-level recon docblock): a login form (email step or password step) or the review
  // screen (already-authenticated session). Returns 'unknown' if neither signal appears within
  // the timeout — callers must treat that as a failed popup load.
  private async waitForPayPalPopupReady(): Promise<'login' | 'review' | 'unknown'> {
    let state: 'login' | 'review' | 'unknown' = 'unknown';
    await this.waits
      .waitForCustomCondition(
        async () => {
          if (await this.elements.isElementDisplayed(this.paypalEmailFieldSelector)) {
            state = 'login';
            return true;
          }
          if ((await this.resolveAgreeContinueSelector()) !== null) {
            state = 'review';
            return true;
          }
          return false;
        },
        { timeout: TIMEOUTS.NETWORK_IDLE_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
    return state;
  }

  // E2E-PLAORD-001 — Drives the PayPal sandbox popup from whichever state
  // waitForPayPalPopupReady() detected through to a click on "Agree & Continue". Must be
  // called with `this.page` already switched to the popup (see completeBraintreePayPalCheckout).
  // Returns false (never throws) if the popup never reached a recognised state or the final
  // confirm button never appeared.
  private async completePayPalSandboxPopupFlow(account: PayPalSandboxAccount): Promise<boolean> {
    const popupState = await this.waitForPayPalPopupReady();
    if (popupState === 'unknown') return false;

    if (popupState === 'login') {
      await this.elements.enterText(this.paypalEmailFieldSelector, account.email);
      await this.elements.clickElement(this.paypalNextButtonSelector);
      await this.waits
        .waitForCustomCondition(() => this.elements.isElementDisplayed(this.paypalPasswordFieldSelector), {
          timeout: TIMEOUTS.DIALOG_APPEAR,
          interval: TIMEOUTS.POLL_INTERVAL_FAST,
        })
        .catch(() => {});
      await this.elements.enterText(this.paypalPasswordFieldSelector, account.password);
      await this.elements.clickElement(this.paypalLogInButtonSelector);
      await this.waits
        .waitForCustomCondition(async () => (await this.resolveAgreeContinueSelector()) !== null, {
          timeout: TIMEOUTS.NETWORK_IDLE_SLOW,
          interval: TIMEOUTS.POLL_INTERVAL_NORMAL,
        })
        .catch(() => {});
    }

    const agreeSelector = await this.resolveAgreeContinueSelector();
    if (agreeSelector === null) return false;
    await this.elements.clickElement(agreeSelector);
    return true;
  }

  // E2E-PLAORD-001 — Polls (best-effort) until the storefront URL reaches /ordersuccess. Call
  // after switching `this.page` back to the opener tab following the PayPal popup flow — the
  // redirect is asynchronous and lagged several seconds behind the popup closing in recon.
  async waitForOrderSuccess(): Promise<boolean> {
    let found = false;
    await this.waits
      .waitForCustomCondition(
        async () => {
          found = this.orderSuccessUrlPattern.test(this.page.url());
          return found;
        },
        { timeout: TIMEOUTS.PAGE_LOAD_SLOW, interval: TIMEOUTS.POLL_INTERVAL_NORMAL },
      )
      .catch(() => {});
    return found;
  }

  // E2E-PLAORD-001 — Extracts the "Order Number <code>" text on the /ordersuccess surface.
  // Returns null (never throws) if the pattern is not found.
  //
  // RECON FINDING (confirmed live, Vans NZ staging) — waitForOrderSuccess() gates on the URL
  // reaching /ordersuccess, but the order-details content within that route's shared app shell
  // can still be rendering (e.g. an async order-lookup fetch) at the moment the URL check
  // passes — a single one-shot read raced ahead of that content and read null even though the
  // order had genuinely succeeded. Polls the same read for DIALOG_APPEAR before giving up, the
  // same settle pattern used elsewhere in this class (e.g. hasRequiredFieldValidation()).
  async getOrderConfirmationNumber(): Promise<string | null> {
    let orderNumber: string | null = null;
    await this.waits
      .waitForCustomCondition(
        async () => {
          orderNumber = await this.page
            .evaluate((patternSrc: string) => {
              const re = new RegExp(patternSrc, 'i');
              const match = document.body.innerText.match(re);
              return match ? match[1] : null;
            }, this.orderNumberTextPattern.source)
            .catch(() => null);
          return orderNumber !== null;
        },
        { timeout: TIMEOUTS.DIALOG_APPEAR, interval: TIMEOUTS.POLL_INTERVAL_FAST },
      )
      .catch(() => {});
    return orderNumber;
  }

  // E2E-PLAORD-001 — Orchestrates the full PayPal Smart Button -> popup -> sandbox login/review
  // -> order-success round trip. Assumes selectPayPalPaymentMethod() and
  // waitForPayPalSmartButtonReady() have already been called (kept as separate steps so the
  // spec can assert/log each transition, matching this file's other checkout flows). Restores
  // `this.page` to the storefront (opener) tab before returning.
  //
  // Popup close ordering is deliberate: the popup is left open across waitForOrderSuccess(),
  // not closed immediately after the "Agree & Continue" click. completePayPalSandboxPopupFlow()
  // returns as soon as that click is dispatched — at that moment PayPal is still posting the
  // approval and relaying it back to the opener over its cross-window message bridge before the
  // popup closes itself, which (per the class-level recon docblock) is not instant. An earlier
  // version of this method closed the popup at that point and it reliably cut off the callback
  // the opener was still waiting on, so no order was ever placed. The popup is only closed here
  // (if the PayPal SDK has not already closed it itself) after the opener's own order-success
  // outcome is known, win or lose.
  async completeBraintreePayPalCheckout(account: PayPalSandboxAccount): Promise<boolean> {
    const openerPage = this.page;

    const popupPromise = this.tabs.waitForNewWindowAndSwitch(TIMEOUTS.NETWORK_IDLE_SLOW);
    const smartButtonClicked = await this.clickPayPalSmartButton();
    if (!smartButtonClicked) {
      // Settle the still-pending context().waitForEvent('page') listener before returning —
      // leaving it dangling surfaces as an unrelated "Test ended" error at teardown.
      await popupPromise.catch(() => {});
      return false;
    }

    try {
      await popupPromise;
    } catch {
      // waitForNewWindowAndSwitch may have already pointed pageRef.current at the popup
      // (during bringToFront()/waitForLoadState()) before throwing — restore the opener.
      await this.tabs.switchToPage(openerPage);
      return false;
    }
    const popupPage = this.page;

    let popupCompleted: boolean;
    try {
      popupCompleted = await this.completePayPalSandboxPopupFlow(account);
    } finally {
      await this.tabs.switchToPage(openerPage);
    }

    if (!popupCompleted) {
      if (!popupPage.isClosed()) await popupPage.close().catch(() => {});
      return false;
    }

    const orderSucceeded = await this.waitForOrderSuccess();
    if (!popupPage.isClosed()) await popupPage.close().catch(() => {});
    return orderSucceeded;
  }
}

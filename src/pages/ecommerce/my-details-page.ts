import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../base-page';
import { TIMEOUTS } from '../../constants/timeouts';
import { type NewSavedAddressData } from '../../data/ecommerce/test-accounts';

// E2E-CHKOUT-009 — RECON FINDINGS (Dr. Martens AU staging, confirmed live):
//
// "Add New Address" opens an <aside> drawer (heading "Add new address"). Its default view
// exposes an address-autocomplete field (name="street", labelled "Address" there); clicking
// "Enter address manually" reveals discrete street/country/city/postcode inputs instead — this
// page object only ever fills the manual-entry view. `country` is disabled and pre-filled by the
// storefront itself; never attempt to fill it. The UI label on the city field may read "Suburb"
// but its `name` attribute is `city`.
//
// The State/Region control is a custom combobox (`<div data-region="state">`), NOT a native
// input/select — a raw DOM click via page.evaluate() fails silently (same event-delegation gap
// documented on EcommerceAccountModalPage's account-toggle button), so it must be opened with a
// genuine, trusted Locator.click(). Its options render as `<li class="option">` elements.
//
// The "Make this my default address" checkbox is a custom control: `input[type="checkbox"
// readonly]` does not toggle via `.check()`, and the sibling `<p>` label text is not a wrapping
// `<label>` so clicking it has no effect. The reliable click target is the checkbox's own
// `<span class="checkBox-mark">`.
//
// The submit button's accessible text is literally "ADD" — matched with an exact-match role
// locator, since the drawer also renders an unrelated "Find my address" button that a
// substring/`:has-text()` match against "ADD" could ambiguously catch.
export class EcommerceMyDetailsPage extends BasePage {
  private readonly myDetailsPath = '/my-details';

  private readonly mainElement: Locator = this.page.locator('main');

  private readonly addNewAddressButton: Locator = this.page
    .getByRole('button', { name: /add new address/i })
    .first();

  private readonly addAddressDrawer: Locator = this.page
    .getByRole('complementary')
    .filter({ hasText: /add new address/i })
    .first();

  private readonly enterAddressManuallyButton: Locator = this.addAddressDrawer.getByRole('button', {
    name: /enter address manually/i,
  });

  private readonly addressNameInput: Locator = this.addAddressDrawer.locator('input[name="addressName"]');
  private readonly firstNameInput: Locator = this.addAddressDrawer.locator('input[name="firstname"]');
  private readonly lastNameInput: Locator = this.addAddressDrawer.locator('input[name="lastname"]');
  private readonly telephoneInput: Locator = this.addAddressDrawer.locator('input[name="telephone"]');
  private readonly streetInput: Locator = this.addAddressDrawer.locator('input[name="street"]');
  private readonly cityInput: Locator = this.addAddressDrawer.locator('input[name="city"]');
  private readonly postcodeInput: Locator = this.addAddressDrawer.locator('input[name="postcode"]');

  private readonly regionCombobox: Locator = this.addAddressDrawer.locator('[data-region="state"]');
  private readonly regionOptionList: Locator = this.addAddressDrawer.locator('li.option');

  private readonly defaultAddressCheckboxMark: Locator = this.addAddressDrawer
    .locator('span.checkBox-mark')
    .first();

  private readonly submitAddButton: Locator = this.addAddressDrawer.getByRole('button', {
    name: 'ADD',
    exact: true,
  });

  constructor(page: Page) {
    super(page);
  }

  async navigateToMyDetails(baseUrl: string): Promise<void> {
    const url = new URL(this.myDetailsPath, baseUrl).toString();
    await this.gotoWithOptions(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NETWORK_IDLE_SLOW });
    await this.elements.waitForLocatorVisible(this.mainElement, TIMEOUTS.PAGE_LOAD);
  }

  async openAddNewAddressDrawer(): Promise<void> {
    await this.elements.clickLocator(this.addNewAddressButton);
    await this.elements.waitForLocatorVisible(this.addAddressDrawer, TIMEOUTS.ELEMENT_VISIBLE);
  }

  async isAddAddressDrawerVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.addAddressDrawer);
  }

  async clickEnterAddressManually(): Promise<void> {
    await this.elements.clickLocator(this.enterAddressManuallyButton);
    // Discrete fields replace the autocomplete field in the same drawer — wait for the
    // manual-entry street input to actually be the one rendered before any field is filled.
    await this.elements.waitForLocatorVisible(this.streetInput, TIMEOUTS.ELEMENT_VISIBLE);
  }

  async fillAddressDetails(data: NewSavedAddressData): Promise<void> {
    await this.elements.fillLocator(this.addressNameInput, data.addressName);
    await this.elements.fillLocator(this.firstNameInput, data.firstName);
    await this.elements.fillLocator(this.lastNameInput, data.lastName);
    await this.elements.fillLocator(this.telephoneInput, data.phoneNumber);
    await this.elements.fillLocator(this.streetInput, data.street);
    await this.elements.fillLocator(this.cityInput, data.city);
    await this.elements.fillLocator(this.postcodeInput, data.postcode);
  }

  // Returns true if the custom Region/State combobox is visible on this storefront. Callers on
  // unreconned storefronts should check this before openRegionDropdown() — the combobox's
  // `[data-region="state"]` selector was only confirmed live on Dr. Martens AU; other storefronts
  // may render this field differently and should test.skip() rather than time out on a click.
  async isRegionComboboxVisible(): Promise<boolean> {
    return this.elements.isLocatorVisible(this.regionCombobox);
  }

  // Opens the custom Region/State combobox. Must be a genuine trusted click — see class docblock.
  async openRegionDropdown(): Promise<void> {
    await this.elements.clickLocator(this.regionCombobox);
  }

  // Returns the visible option labels of the currently-open Region/State combobox. Callers on
  // unreconned storefronts should confirm their expected region label is present here before
  // calling selectRegionOption() — an absent option means the storefront's region vocabulary
  // differs from what the test data assumed, and the caller should test.skip() that iteration.
  async getRegionOptionTexts(): Promise<string[]> {
    await this.elements.waitForLocatorVisible(this.regionOptionList.first(), TIMEOUTS.ELEMENT_VISIBLE);
    const texts = await this.regionOptionList.allInnerTexts().catch(() => [] as string[]);
    return texts.map((t) => t.trim()).filter((t) => t.length > 0);
  }

  // Selects the option whose text exactly matches `regionLabel` (case-insensitive). Returns
  // false without clicking anything if no such option is visible — never a `.fill()`, since this
  // is a custom combobox, not a native select.
  async selectRegionOption(regionLabel: string): Promise<boolean> {
    const escaped = regionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const option = this.regionOptionList.filter({ hasText: new RegExp(`^${escaped}$`, 'i') }).first();
    const visible = await this.elements.isLocatorVisible(option);
    if (!visible) return false;
    await this.elements.clickLocator(option);
    return true;
  }

  // Ticks "Make this my default address" via the checkbox's own <span class="checkBox-mark"> —
  // see class docblock for why the input itself and the sibling <p> label are not valid targets.
  async setAsDefaultAddress(): Promise<void> {
    await this.elements.clickLocator(this.defaultAddressCheckboxMark);
  }

  // Submits the drawer form. The accessible button text is the exact string "ADD" — see class
  // docblock for why an exact-match locator is required. Waits for the drawer to close as
  // confirmation the create-address mutation actually completed server-side before any caller
  // reads the result back (e.g. via GraphQL) — a bare click resolves as soon as the browser event
  // fires, not when the save itself finishes, which raced the GraphQL read-back in
  // checkout-address-prefill.spec.ts. Best-effort: falls through on timeout so the caller's own
  // assertions remain the source of truth.
  async submitNewAddress(): Promise<void> {
    await this.elements.clickLocator(this.submitAddButton);
    await this.elements.waitForLocatorHidden(this.addAddressDrawer, TIMEOUTS.NETWORK_IDLE_SLOW);
  }
}

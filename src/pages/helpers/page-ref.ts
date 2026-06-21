import { Page } from "@playwright/test";

/** Mutable page reference shared between BasePage and all helpers.
 * When a tab switch updates pageRef.current, every helper automatically
 * operates on the new tab without reconstruction.
 *
 * NOTE: pre-bound class-field locators (e.g. `private readonly btn = this.page.getByRole(...)`)
 * are permanently bound to the page that created them and will NOT follow tab switches.
 * Only selector-based helper calls (e.g. `this.elements.clickElement('#x')`) follow the
 * active tab.
 */
export interface PageRef {
  current: Page;
}

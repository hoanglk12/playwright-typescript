import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { ServicesAZData } from '../../data/services-az-data';
import { TIMEOUTS } from '../../constants/timeouts';

export interface LetterInfo {
  letter: string;
  enabled: boolean;
  locator: Locator;
}

export class ServicesAZPage extends BasePage {
  // ── Navigation locators ───────────────────────────────────────────
  private readonly hamburgerMenuBtn: Locator;
  private readonly sideNavLink = '.side-navigation__link';
  // WHY: scoped to the <li> containing the /en/services link so no structural chaining is needed;
  // the button is the expand toggle beside the Services nav link (no accessible name on the element)
  private readonly servicesNavToggle = this.page.getByRole('navigation').locator('li').filter({
    has: this.page.locator('a[href="/en/services"]'),
  }).getByRole('button');
  private readonly servicesAZLink = 'nav a[href="/en/services/services-a-z-list"]';
  private readonly pageMainHeading = 'main h1';

  // ── A-Z page locators ─────────────────────────────────────────────
  getSectionHeading(letter: string): Locator {
    return this.page.locator('main h2').filter({ hasText: new RegExp(`^${letter}$`) });
  }
  private sectionServiceLinks(letter: string): Locator {
    return this.page
      .locator('main div.az-list__listing-segment-inner')
      .filter({ has: this.page.locator('h2').filter({ hasText: new RegExp(`^${letter}$`) }) })
      .locator('ul a');
  }

  constructor(page: Page) {
    super(page);
    this.hamburgerMenuBtn = page.getByRole('button', { name: 'Menu' });
  }

  // ── Navigation helpers ────────────────────────────────────────────

  async navigateToHomePage(): Promise<void> {
    await this.gotoWithOptions(ServicesAZData.homePageUrl, {
      waitUntil: 'domcontentloaded',
    });
    await this.hamburgerMenuBtn.waitFor({
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }
  async openHamburgerMenu(): Promise<void> {
    await this.hamburgerMenuBtn.click();
    await this.elements.locator(this.sideNavLink).first().waitFor({
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  async expandServicesSubMenu(): Promise<void> {
    await this.elements.clickLocator(this.servicesNavToggle);
    await this.elements.locator(this.servicesAZLink).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  async clickServicesAZLink(): Promise<void> {
    await Promise.all([
      this.waits.waitForPageLoadState('domcontentloaded', TIMEOUTS.PAGE_LOAD),
      this.elements.locator(this.servicesAZLink).click(),
    ]);
    await this.elements.locator(this.pageMainHeading).first().waitFor({
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  async navigateToServicesAZListViaMenu(): Promise<void> {
    await this.navigateToHomePage();
    await this.openHamburgerMenu();
    await this.expandServicesSubMenu();
    await this.clickServicesAZLink();
  }

  // ── A-Z letter helpers ────────────────────────────────────────────

  async getAllLetters(): Promise<LetterInfo[]> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const letters: LetterInfo[] = [];

    for (const char of alphabet) {
      // WHY: `char` is a loop variable — this locator is built dynamically per letter and cannot be a class field
      const loc = this.page.locator(`a`).filter({ hasText: new RegExp(`^${char.toLowerCase()}$|^${char}$`) }).and(
        this.page.locator(`a[href="#"]`)
      );

      const ariaLoc = this.page.getByRole('link', { name: `Letter ${char}` });
      const finalLoc = (await ariaLoc.count()) > 0 ? ariaLoc : loc;

      let enabled = false;
      if ((await finalLoc.count()) > 0) {
        // Check cursor style – enabled letters have cursor: pointer
        const cursor = await finalLoc.evaluate(
          (el) => window.getComputedStyle(el).cursor
        );
        enabled = cursor === 'pointer';
      }

      letters.push({ letter: char, enabled, locator: finalLoc });
    }

    return letters;
  }

  async getEnabledLetters(): Promise<LetterInfo[]> {
    const all = await this.getAllLetters();
    return all.filter((l) => l.enabled);
  }

  async clickRandomEnabledLetter(): Promise<string> {
    const enabled = await this.getEnabledLetters();
    if (enabled.length === 0) {
      throw new Error('No enabled letters found in the A-Z filter bar.');
    }
    const pick = enabled[Math.floor(Math.random() * enabled.length)];
    await pick.locator.click();
    return pick.letter;
  }

  // ── Assertion helpers ─────────────────────────────────────────────

  async isSectionHeadingInViewport(letter: string): Promise<boolean> {
    const heading = this.getSectionHeading(letter);
    await heading.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // WHY: no WaitHelper equivalent for arbitrary JS polling
    const elementHandle = await heading.elementHandle();
    if (elementHandle) {
      await this.page.waitForFunction(
        (el) => {
          const rect = (el as Element).getBoundingClientRect();
          return rect.top >= -50 && rect.bottom <= window.innerHeight + 50;
        },
        elementHandle,
        { timeout: TIMEOUTS.ELEMENT_VISIBLE },
      ).catch(() => { /* heading may be just outside viewport on narrow screens */ });
    }

    return heading.evaluate((el: Element) => {
      const rect = el.getBoundingClientRect();
      // sticky header may push it down, so we use a generous range
      return (
        rect.top >= -50 &&
        rect.bottom <= window.innerHeight + 50 &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth
      );
    });
  }

  async getServiceNamesForLetter(letter: string): Promise<string[]> {
    const links = this.sectionServiceLinks(letter);
    return links.allTextContents();
  }

  async getPageHeading(): Promise<string> {
    const heading = this.elements.locator(this.pageMainHeading).first();
    await heading.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    return (await heading.textContent())?.trim() || '';
  }
}

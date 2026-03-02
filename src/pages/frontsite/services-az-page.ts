import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base-page';
import { ServicesAZData } from '../../data/services-az-data';
import { TIMEOUTS } from '../../constants/timeouts';

/**
 * Represents a single A-Z letter filter entry.
 */
export interface LetterInfo {
  /** The uppercase letter (A-Z) */
  letter: string;
  /** Whether the link is enabled (has services) */
  enabled: boolean;
  /** The Playwright Locator for the link */
  locator: Locator;
}

/**
 * Services A-Z List Page Object
 *
 * Covers:
 * - Navigation via hamburger menu → Services → Services A-Z List
 * - A-Z letter filter bar interaction
 * - Scroll-to-section verification after clicking a letter
 */
export class ServicesAZPage extends BasePage {
  // ── Navigation locators ───────────────────────────────────────────
  private readonly hamburgerMenu = 'button[aria-label="Menu"]';
  private readonly sideNavLink = '.side-navigation__link';
  private readonly servicesExpandButton =
    'nav li:has(> div > a[href="/en/services"]) button';
  private readonly servicesAZLink = 'nav a[href="/en/services/services-a-z-list"]';

  // ── A-Z page locators ─────────────────────────────────────────────
  /** The <ul> that contains all 26 letter filter links */
  private readonly letterList = 'main ul';
  /** Individual letter link selector pattern – the accessible name is "Letter X" */
  private readonly letterLinkSelector = (letter: string) =>
    `a[aria-label="Letter ${letter}"]`;
  /** Section heading for a given letter (e.g. <h2>D</h2>) */
  private readonly sectionHeading = (letter: string) =>
    `main h2:text-is("${letter}")`;
  /** Service items within the section that follows the heading */
  private readonly sectionServiceLinks = (letter: string) =>
    `main div.az-list__listing-segment-inner:has(h2:text-is("${letter}")) ul a`;

  constructor(page: Page) {
    super(page);
  }

  // ── Navigation helpers ────────────────────────────────────────────

  /**
   * Navigate to the homepage.
   */
  async navigateToHomePage(): Promise<void> {
    await this.page.goto(ServicesAZData.homePageUrl);
    await this.waitForDOMContentLoaded();
  }

  /**
   * Open the hamburger / side navigation menu.
   */
  async openHamburgerMenu(): Promise<void> {
    await this.clickElement(this.hamburgerMenu);
    await this.page.waitForSelector(this.sideNavLink, {
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  /**
   * Expand the "Services" sub-menu inside the side navigation.
   */
  async expandServicesSubMenu(): Promise<void> {
    await this.page.locator(this.servicesExpandButton).click();
    await this.page.locator(this.servicesAZLink).waitFor({
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  /**
   * Click the "Services A-Z List" link inside the expanded services menu.
   */
  async clickServicesAZLink(): Promise<void> {
    await Promise.all([
      this.page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.PAGE_LOAD }),
      this.page.locator(this.servicesAZLink).click(),
    ]);
    // Confirm we actually landed on the A-Z page
    await this.page.waitForSelector('main h1', {
      state: 'visible',
      timeout: TIMEOUTS.ELEMENT_VISIBLE,
    });
  }

  /**
   * Full navigation flow:
   * Homepage → hamburger → Services → Services A-Z List
   */
  async navigateToServicesAZListViaMenu(): Promise<void> {
    await this.navigateToHomePage();
    await this.openHamburgerMenu();
    await this.expandServicesSubMenu();
    await this.clickServicesAZLink();
  }

  // ── A-Z letter helpers ────────────────────────────────────────────

  /**
   * Return information about every letter in the A-Z filter bar.
   *
   * A letter is considered **enabled** if its link element has a
   * computed `text-decoration` that includes `underline` OR if the cursor
   * style is `pointer` (the page uses `cursor: pointer` on enabled links).
   */
  async getAllLetters(): Promise<LetterInfo[]> {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const letters: LetterInfo[] = [];

    for (const char of alphabet) {
      const loc = this.page.locator(`a`).filter({ hasText: new RegExp(`^${char.toLowerCase()}$|^${char}$`) }).and(
        this.page.locator(`a[href="#"]`)
      );

      // Fallback: use aria-label-based locator to be sure
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

  /**
   * Return only the enabled (clickable) letters.
   */
  async getEnabledLetters(): Promise<LetterInfo[]> {
    const all = await this.getAllLetters();
    return all.filter((l) => l.enabled);
  }

  /**
   * Pick a random enabled letter and click it.
   * @returns The uppercase letter that was clicked.
   */
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

  /**
   * Returns `true` when the section heading for the given letter is
   * inside the current viewport (i.e. the page scrolled to it).
   */
  async isSectionHeadingInViewport(letter: string): Promise<boolean> {
    const heading = this.page.locator(this.sectionHeading(letter));
    await heading.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });

    // Wait for smooth-scroll animation to settle
    await this.page.waitForTimeout(1500);

    return heading.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      // Allow heading to be anywhere in the visible viewport
      // (sticky header may push it down, so we use a generous range)
      return (
        rect.top >= -50 &&
        rect.bottom <= window.innerHeight + 50 &&
        rect.left >= 0 &&
        rect.right <= window.innerWidth
      );
    });
  }

  /**
   * Get the list of service names displayed under a letter section.
   */
  async getServiceNamesForLetter(letter: string): Promise<string[]> {
    const links = this.page.locator(this.sectionServiceLinks(letter));
    return links.allTextContents();
  }

  /**
   * Get the page heading text to confirm we are on the correct page.
   */
  async getPageHeading(): Promise<string> {
    const heading = this.page.locator('main h1').first();
    await heading.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBLE });
    return (await heading.textContent())?.trim() || '';
  }
}

import { Page } from "@playwright/test";
import {
  WaitHelper,
  ElementHelper,
  StyleHelper,
  FrameHelper,
  FileHelper,
  StorageHelper,
  NetworkHelper,
  TableHelper,
} from "./helpers/index";

/**
 * Base class for all page objects.
 *
 * Compose specialised helpers rather than adding methods here directly:
 *   this.waits.*    — page/element/network synchronisation
 *   this.elements.* — interactions, queries, scroll, keyboard
 *   this.style.*    — computed colour, dimension, CSS reads
 *   this.frames.*   — iframe operations (frameLocator API)
 *   this.files.*    — file upload / drag-and-drop
 *   this.storage.*  — cookies, localStorage, sessionStorage, clipboard
 *   this.network.*  — route mocking, request monitoring, performance
 *   this.tables.*   — HTML table interactions
 *
 * The delegated methods below keep the existing page-object call-sites working.
 */
export abstract class BasePage {
  protected page: Page;

  // ── Helpers (use these in subclasses for new code) ──────────────────────────
  protected readonly waits: WaitHelper;
  protected readonly elements: ElementHelper;
  protected readonly style: StyleHelper;
  protected readonly frames: FrameHelper;
  protected readonly files: FileHelper;
  protected readonly storage: StorageHelper;
  protected readonly network: NetworkHelper;
  protected readonly tables: TableHelper;

  constructor(page: Page) {
    this.page = page;
    this.waits = new WaitHelper(page);
    this.elements = new ElementHelper(page, this.waits);
    this.style = new StyleHelper(page, this.waits);
    this.frames = new FrameHelper(page);
    this.files = new FileHelper(page, this.waits);
    this.storage = new StorageHelper(page);
    this.network = new NetworkHelper(page);
    this.tables = new TableHelper(page, this.waits, this.elements);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async refreshPage(): Promise<void> {
    await this.page.reload();
  }

  async navigateBack(): Promise<void> {
    await this.page.goBack();
  }

  async navigateForward(): Promise<void> {
    await this.page.goForward();
  }

  // ── Window / tab management ─────────────────────────────────────────────────
  // Kept here because these methods mutate this.page.

  async acceptAlert(): Promise<void> {
    this.page.once("dialog", (dialog) => dialog.accept());
  }

  async dismissAlert(): Promise<void> {
    this.page.once("dialog", (dialog) => dialog.dismiss());
  }

  async switchToWindowByTitle(expectedTitle: string): Promise<void> {
    for (const pg of this.page.context().pages()) {
      if ((await pg.title()) === expectedTitle) {
        this.page = pg;
        await pg.bringToFront();
        break;
      }
    }
  }

  async switchToWindowById(parentPage: Page): Promise<void> {
    for (const pg of this.page.context().pages()) {
      if (pg !== parentPage) {
        this.page = pg;
        await pg.bringToFront();
        break;
      }
    }
  }

  async switchToWindowByIndex(index: number): Promise<void> {
    const allPages = this.page.context().pages();
    if (index < 0 || index >= allPages.length) {
      throw new Error(`Window index ${index} out of range. Available: ${allPages.length}`);
    }
    this.page = allPages[index];
    await this.page.bringToFront();
  }

  async switchToWindowByUrl(urlPattern: string | RegExp): Promise<boolean> {
    for (const pg of this.page.context().pages()) {
      const url = pg.url();
      const match =
        typeof urlPattern === "string" ? url.includes(urlPattern) : urlPattern.test(url);
      if (match) {
        this.page = pg;
        await pg.bringToFront();
        return true;
      }
    }
    return false;
  }

  async switchToLatestWindow(): Promise<void> {
    const allPages = this.page.context().pages();
    if (allPages.length > 0) {
      this.page = allPages[allPages.length - 1];
      await this.page.bringToFront();
    }
  }

  async closeAllWindowsWithoutParent(parentPage: Page): Promise<void> {
    for (const pg of this.page.context().pages()) {
      if (pg !== parentPage) await pg.close();
    }
    (this as unknown as { page: Page }).page = parentPage;
    await parentPage.bringToFront();
  }

  async closeCurrentWindowAndSwitchToParent(parentPage: Page): Promise<void> {
    const current = this.page;
    (this as unknown as { page: Page }).page = parentPage;
    await parentPage.bringToFront();
    await current.close();
  }

  async closeAllTabsExceptCurrent(): Promise<void> {
    const current = this.page;
    for (const pg of this.page.context().pages()) {
      if (pg !== current) await pg.close();
    }
  }

  async waitForNewWindowAndSwitch(timeout = 10000): Promise<void> {
    const newPage = await this.page.context().waitForEvent("page", { timeout });
    this.page = newPage;
    await newPage.bringToFront();
    await newPage.waitForLoadState("domcontentloaded");
  }

  async openNewTab(url?: string): Promise<void> {
    const newPage = await this.page.context().newPage();
    if (url) await newPage.goto(url);
    this.page = newPage;
    await newPage.bringToFront();
  }

  async getWindowCount(): Promise<number> {
    return this.page.context().pages().length;
  }

  async getAllWindowTitles(): Promise<string[]> {
    const titles: string[] = [];
    for (const pg of this.page.context().pages()) {
      titles.push(await pg.title());
    }
    return titles;
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test_${timestamp}_${random}@automation.com`;
  }

  generateRandomNumber(min = 1000, max = 9999): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async executeScript<T>(fn: () => T | Promise<T>): Promise<T>;
  /** @deprecated Pass a typed function instead: executeScript(() => expression) */
  async executeScript<T>(script: string, ...args: unknown[]): Promise<T>;
  async executeScript<T>(fnOrScript: (() => T | Promise<T>) | string, ...args: unknown[]): Promise<T> {
    if (typeof fnOrScript === "string") {
      return await this.page.evaluate(fnOrScript, ...args) as T;
    }
    return await this.page.evaluate(fnOrScript);
  }

  async getWindowSize(): Promise<{ width: number; height: number }> {
    return await this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
  }

  async setWindowSize(width: number, height: number): Promise<void> {
    await this.page.setViewportSize({ width, height });
  }

  // ── Backward-compatible delegations ─────────────────────────────────────────
  // These preserve the call-sites in existing page objects.
  // Prefer calling this.waits.* / this.elements.* / this.style.* directly in new code.

  // waits
  async waitForPageLoad(): Promise<void> { return this.waits.waitForPageLoad(); }
  async waitForPageLoadState(state?: "load" | "domcontentloaded" | "networkidle", timeout?: number): Promise<void> {
    return this.waits.waitForPageLoadState(state, timeout);
  }
  async waitForNetworkIdle(timeout?: number, throwOnTimeout?: boolean): Promise<void> { return this.waits.waitForNetworkIdle(timeout, throwOnTimeout); }
  async waitForCompletePageLoad(options?: Parameters<WaitHelper["waitForCompletePageLoad"]>[0]): Promise<void> {
    return this.waits.waitForCompletePageLoad(options);
  }
  /** @deprecated Use waitForPageLoad() */
  async waitForFullPageLoad(): Promise<void> { return this.waits.waitForPageLoad(); }
  /** @deprecated Use waitForPageLoadState('domcontentloaded') */
  async waitForDOMContentLoaded(): Promise<void> { return this.waits.waitForPageLoadState("domcontentloaded"); }
  /** @deprecated Use waitForAjaxRequestsComplete() — the advanced retry variant has been simplified away */
  async waitForAjaxRequestsCompleteAdvanced(options: {
    timeout?: number;
    excludeUrls?: string[];
    waitForSpinners?: boolean;
    spinnerSelectors?: string[];
    spinnerTimeout?: number;
  } = {}): Promise<void> {
    const {
      timeout,
      excludeUrls,
      waitForSpinners = true,
      spinnerSelectors = [".spinner", ".ajax-loader", ".loading-spinner", ".loading-overlay", "[role='progressbar']", "[aria-busy='true']"],
      spinnerTimeout,
    } = options;
    await this.waits.waitForAjaxRequestsComplete(timeout, excludeUrls);
    if (waitForSpinners) {
      await this.waits.waitForSpinnersToDisappear(spinnerSelectors, spinnerTimeout);
    }
  }
  async waitForElement(selector: string, timeout?: number): Promise<void> { return this.waits.waitForElement(selector, timeout); }
  async waitForElementClickable(selector: string, timeout?: number): Promise<void> { return this.waits.waitForElementClickable(selector, timeout); }
  async waitForUrlContains(text: string, timeout?: number): Promise<void> { return this.waits.waitForUrlContains(text, timeout); }
  async waitForUrlMatches(pattern: RegExp, timeout?: number): Promise<void> { return this.waits.waitForUrlMatches(pattern, timeout); }
  async waitForElementText(selector: string, expectedText: string, timeout?: number): Promise<void> { return this.waits.waitForElementText(selector, expectedText, timeout); }
  async waitForElementAttribute(selector: string, attribute: string, expectedValue: string, timeout?: number): Promise<void> { return this.waits.waitForElementAttribute(selector, attribute, expectedValue, timeout); }
  async waitForCustomCondition(condition: () => Promise<boolean> | boolean, options?: { timeout?: number; interval?: number }): Promise<void> { return this.waits.waitForCustomCondition(condition, options); }
  async waitForAjaxRequest(urlPattern: string | RegExp, timeout?: number): Promise<void> { return this.waits.waitForAjaxRequest(urlPattern, timeout); }
  async waitForAjaxRequestsComplete(timeout?: number, excludeUrls?: string[], throwOnTimeout?: boolean): Promise<void> { return this.waits.waitForAjaxRequestsComplete(timeout, excludeUrls, throwOnTimeout); }
  async waitForAllImagesLoaded(): Promise<void> { return this.waits.waitForAllImagesLoaded(); }
  async waitForSpinnersToDisappear(selectors: string[], timeout?: number): Promise<void> { return this.waits.waitForSpinnersToDisappear(selectors, timeout); }
  async waitForConsoleMessage(messageText: string, timeout?: number): Promise<void> { return this.waits.waitForConsoleMessage(messageText, timeout); }

  // elements
  async isElementDisplayed(selector: string): Promise<boolean> { return this.elements.isElementDisplayed(selector); }
  async isElementUndisplayed(selector: string, shortTimeout?: number): Promise<boolean> { return this.elements.isElementUndisplayed(selector, shortTimeout); }
  async isElementEnabled(selector: string): Promise<boolean> { return this.elements.isElementEnabled(selector); }
  async isElementDisabled(selector: string): Promise<boolean> { return this.elements.isElementDisabled(selector); }
  async clickElement(selector: string): Promise<void> { return this.elements.clickElement(selector); }
  async doubleClickElement(selector: string): Promise<void> { return this.elements.doubleClickElement(selector); }
  async rightClickElement(selector: string): Promise<void> { return this.elements.rightClickElement(selector); }
  async enterText(selector: string, text: string): Promise<void> { return this.elements.enterText(selector, text); }
  async clearAndEnterText(selector: string, text: string): Promise<void> { return this.elements.clearAndEnterText(selector, text); }
  async getText(selector: string): Promise<string> { return this.elements.getText(selector); }
  async getAllTexts(selector: string): Promise<string[]> { return this.elements.getAllTexts(selector); }
  async getAttribute(selector: string, attribute: string): Promise<string | null> { return this.elements.getAttribute(selector, attribute); }
  async getElementCount(selector: string): Promise<number> { return this.elements.getElementCount(selector); }
  async hasClass(selector: string, className: string): Promise<boolean> { return this.elements.hasClass(selector, className); }
  async getAllClasses(selector: string): Promise<string[]> { return this.elements.getAllClasses(selector); }
  async selectDropdownByValue(selector: string, value: string): Promise<void> { return this.elements.selectDropdownByValue(selector, value); }
  async selectDropdownByText(selector: string, text: string): Promise<void> { return this.elements.selectDropdownByText(selector, text); }
  async selectItemInCustomDropdown(parentLocator: string, childLocator: string, expectedItem: string): Promise<void> { return this.elements.selectItemInCustomDropdown(parentLocator, childLocator, expectedItem); }
  async isChecked(selector: string): Promise<boolean> { return this.elements.isChecked(selector); }
  async check(selector: string): Promise<void> { return this.elements.check(selector); }
  async uncheck(selector: string): Promise<void> { return this.elements.uncheck(selector); }
  async hoverElement(selector: string): Promise<void> { return this.elements.hoverElement(selector); }
  async focusElement(selector: string): Promise<void> { return this.elements.focusElement(selector); }
  async pressKey(key: string): Promise<void> { return this.elements.pressKey(key); }
  async pressKeys(keys: string[]): Promise<void> { return this.elements.pressKeys(keys); }
  async selectAllText(selector: string): Promise<void> { return this.elements.selectAllText(selector); }
  async scrollToElement(selector: string): Promise<void> { return this.elements.scrollToElement(selector); }
  async scrollToTop(): Promise<void> { return this.elements.scrollToTop(); }
  async scrollToBottom(): Promise<void> { return this.elements.scrollToBottom(); }
  async scrollByPixels(x: number, y: number): Promise<void> { return this.elements.scrollByPixels(x, y); }
  async dragAndDrop(sourceSelector: string, targetSelector: string): Promise<void> { return this.elements.dragAndDrop(sourceSelector, targetSelector); }
  async hoverAndGetTooltipAdvanced(selector: string, options?: Parameters<ElementHelper["hoverAndGetTooltipAdvanced"]>[1]): Promise<string> { return this.elements.hoverAndGetTooltipAdvanced(selector, options); }

  // style
  protected rgbToHex(r: number, g: number, b: number): string { return this.style.rgbToHex(r, g, b); }
  protected convertColorToHex(colorString: string): string { return this.style.convertColorToHex(colorString); }
  async getElementBackgroundColorHex(selector: string): Promise<string> { return this.style.getElementBackgroundColorHex(selector); }
  async getAllElementsBackgroundColorHex(selector: string): Promise<string[]> { return this.style.getAllElementsBackgroundColorHex(selector); }
  async getElementTextColorHex(selector: string): Promise<string> { return this.style.getElementTextColorHex(selector); }
  async getElementBorderColorHex(selector: string): Promise<string> { return this.style.getElementBorderColorHex(selector); }
  async getElementDimensions(selector: string): Promise<string> { return this.style.getElementDimensions(selector); }
  async getElementDimensionsObject(selector: string): Promise<{ width: number; height: number }> { return this.style.getElementDimensionsObject(selector); }
  async getImageNaturalDimensions(selector: string): Promise<string> { return this.style.getImageNaturalDimensions(selector); }
  async getCSSProperty(selector: string, property: string): Promise<string> { return this.style.getCSSProperty(selector, property); }

  // files
  async uploadFile(selector: string, filePath: string): Promise<void> { return this.files.uploadFile(selector, filePath); }
  async uploadMultipleFiles(selector: string, filePaths: string[]): Promise<void> { return this.files.uploadMultipleFiles(selector, filePaths); }
  async clearUploadedFiles(selector: string): Promise<void> { return this.files.clearUploadedFiles(selector); }
  async dragAndDropFile(filePath: string, uploadFileSelector: string): Promise<void> { return this.files.dragAndDropFile(filePath, uploadFileSelector); }
}

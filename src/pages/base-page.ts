import { type Locator, Page } from "@playwright/test";
import {
  WaitHelper,
  ElementHelper,
  StyleHelper,
  FrameHelper,
  FileHelper,
  StorageHelper,
  NetworkHelper,
  TableHelper,
  TabHelper,
  DomScanHelper,
  OverlayHelper,
  PageRef,
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
 *   this.tabs.*     — window/tab switching, dialog accept/dismiss
 *   this.dom.*      — non-throwing DOM inspection queries
 *   this.overlays.* — cookie banner / popup / modal dismissal
 *
 * The delegated methods below keep the existing page-object call-sites working.
 */
export abstract class BasePage {
  protected readonly pageRef: PageRef;

  /** Read-only view of the active page. Updated automatically by TabHelper on tab switches. */
  protected get page(): Page {
    return this.pageRef.current;
  }

  // ── Helpers (use these in subclasses for new code) ──────────────────────────
  protected readonly waits: WaitHelper;
  protected readonly elements: ElementHelper;
  protected readonly style: StyleHelper;
  protected readonly frames: FrameHelper;
  protected readonly files: FileHelper;
  protected readonly storage: StorageHelper;
  protected readonly network: NetworkHelper;
  protected readonly tables: TableHelper;
  protected readonly tabs: TabHelper;
  protected readonly dom: DomScanHelper;
  protected readonly overlays: OverlayHelper;

  constructor(page: Page) {
    this.pageRef = { current: page };
    this.waits = new WaitHelper(this.pageRef);
    this.elements = new ElementHelper(this.pageRef, this.waits);
    this.style = new StyleHelper(this.pageRef, this.waits);
    this.frames = new FrameHelper(this.pageRef);
    this.files = new FileHelper(this.pageRef, this.waits);
    this.storage = new StorageHelper(this.pageRef);
    this.network = new NetworkHelper(this.pageRef);
    this.tables = new TableHelper(this.pageRef, this.waits, this.elements);
    this.tabs = new TabHelper(this.pageRef);
    this.dom = new DomScanHelper(this.pageRef);
    this.overlays = new OverlayHelper(this.pageRef, this.elements);
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  protected async gotoWithOptions(url: string, options?: Parameters<Page['goto']>[1]): Promise<void> {
    await this.page.goto(url, options);
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
  // Delegated to TabHelper. Tab switches update pageRef.current so all helpers
  // and navigation methods automatically operate on the newly active tab.

  async acceptAlert(): Promise<void> { return this.tabs.acceptAlert(); }
  async dismissAlert(): Promise<void> { return this.tabs.dismissAlert(); }
  async switchToWindowByTitle(expectedTitle: string): Promise<void> { return this.tabs.switchToWindowByTitle(expectedTitle); }
  async switchToWindowById(parentPage: Page): Promise<void> { return this.tabs.switchToWindowById(parentPage); }
  async switchToWindowByIndex(index: number): Promise<void> { return this.tabs.switchToWindowByIndex(index); }
  async switchToWindowByUrl(urlPattern: string | RegExp): Promise<boolean> { return this.tabs.switchToWindowByUrl(urlPattern); }
  async switchToLatestWindow(): Promise<void> { return this.tabs.switchToLatestWindow(); }
  async closeAllWindowsWithoutParent(parentPage: Page): Promise<void> { return this.tabs.closeAllWindowsWithoutParent(parentPage); }
  async closeCurrentWindowAndSwitchToParent(parentPage: Page): Promise<void> { return this.tabs.closeCurrentWindowAndSwitchToParent(parentPage); }
  async closeAllTabsExceptCurrent(): Promise<void> { return this.tabs.closeAllTabsExceptCurrent(); }
  async waitForNewWindowAndSwitch(timeout = 10000): Promise<void> { return this.tabs.waitForNewWindowAndSwitch(timeout); }
  async openNewTab(url?: string): Promise<void> { return this.tabs.openNewTab(url); }
  async getWindowCount(): Promise<number> { return this.tabs.getWindowCount(); }
  async getAllWindowTitles(): Promise<string[]> { return this.tabs.getAllWindowTitles(); }

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
  async waitForUrlPredicate(predicate: (url: string) => boolean, timeout?: number): Promise<void> { return this.waits.waitForUrlPredicate(predicate, timeout); }
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
  locator(selector: string): Locator { return this.elements.locator(selector); }
  async clickLocator(locator: Locator): Promise<void> { return this.elements.clickLocator(locator); }
  async isLocatorVisible(locator: Locator): Promise<boolean> { return this.elements.isLocatorVisible(locator); }
  async getLocatorAttribute(locator: Locator, attribute: string): Promise<string | null> { return this.elements.getLocatorAttribute(locator, attribute); }

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

  // dom
  async hasAnyVisible(selectors: string[]): Promise<boolean> { return this.dom.hasAnyVisible(selectors); }
  async firstVisible(selectors: string[]): Promise<string | null> { return this.dom.firstVisible(selectors); }
  async getAllTextContents(selector: string): Promise<string[]> { return this.dom.getAllTextContents(selector); }
  async getAllAttributes(selector: string, attribute: string): Promise<string[]> { return this.dom.getAllAttributes(selector, attribute); }
  async hasAriaLabel(selector: string, expected: string, exact?: boolean): Promise<boolean> { return this.dom.hasAriaLabel(selector, expected, exact); }
  async safeGetText(selector: string): Promise<string> { return this.dom.safeGetText(selector); }
  async domCount(selector: string): Promise<number> { return this.dom.count(selector); }

  // overlays
  async dismissCookieBanner(): Promise<boolean> { return this.overlays.dismissCookieBanner(); }
  async dismissPopup(closeSelectors?: string[]): Promise<boolean> { return this.overlays.dismissPopup(closeSelectors); }
  async waitForOverlayGone(overlaySelectors: string[], timeout?: number): Promise<void> { return this.overlays.waitForOverlayGone(overlaySelectors, timeout); }
  async isAnyOverlayVisible(overlaySelectors: string[]): Promise<boolean> { return this.overlays.isAnyOverlayVisible(overlaySelectors); }
  async dismissAll(): Promise<boolean> { return this.overlays.dismissAll(); }
}

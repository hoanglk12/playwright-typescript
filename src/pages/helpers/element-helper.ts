import { type Locator } from "@playwright/test";
import { TIMEOUTS } from "../../constants/timeouts";
import { WaitHelper } from "./wait-helper";
import { PageRef } from "./page-ref";

/** Element queries, interactions, scroll, and keyboard operations. */
export class ElementHelper {
  constructor(
    private readonly pageRef: PageRef,
    private readonly waits: WaitHelper
  ) {}

  // ── Visibility ──────────────────────────────────────────────────────────────

  async isElementDisplayed(selector: string): Promise<boolean> {
    try {
      return await this.pageRef.current.isVisible(selector);
    } catch {
      return false;
    }
  }

  async isElementUndisplayed(
    selector: string,
    shortTimeout: number = TIMEOUTS.TIMEOUT_SHORT
  ): Promise<boolean> {
    try {
      const elements = await this.pageRef.current.locator(selector).all();
      if (elements.length === 0) return true;
      const isVisible = await elements[0].isVisible();
      return !isVisible;
    } catch {
      return true;
    }
  }

  async isElementEnabled(selector: string): Promise<boolean> {
    try {
      await this.waits.waitForElement(selector);
      return await this.pageRef.current.locator(selector).isEnabled();
    } catch {
      return false;
    }
  }

  async isElementDisabled(selector: string): Promise<boolean> {
    return !(await this.isElementEnabled(selector));
  }

  // ── Clicks ──────────────────────────────────────────────────────────────────

  async clickElement(selector: string): Promise<void> {
    await this.waits.waitForElementClickable(selector);
    await this.pageRef.current.click(selector);
  }

  async doubleClickElement(selector: string): Promise<void> {
    await this.waits.waitForElementClickable(selector);
    await this.pageRef.current.dblclick(selector);
  }

  async rightClickElement(selector: string): Promise<void> {
    await this.waits.waitForElementClickable(selector);
    await this.pageRef.current.click(selector, { button: "right" });
  }

  // ── Text input ──────────────────────────────────────────────────────────────

  async enterText(selector: string, text: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.fill(selector, text);
  }

  async clearAndEnterText(selector: string, text: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.fill(selector, "");
    await this.pageRef.current.fill(selector, text);
  }

  // ── Queries ─────────────────────────────────────────────────────────────────

  async getText(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    return (await this.pageRef.current.textContent(selector)) ?? "";
  }

  async getAllTexts(selector: string): Promise<string[]> {
    await this.pageRef.current.waitForSelector(selector, { state: "attached" });
    const elements = await this.pageRef.current.locator(selector).all();
    const texts: string[] = [];
    for (const el of elements) {
      texts.push((await el.textContent())?.trim() ?? "");
    }
    return texts;
  }

  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    await this.waits.waitForElement(selector);
    return await this.pageRef.current.getAttribute(selector, attribute);
  }

  async getElementCount(selector: string): Promise<number> {
    try {
      return await this.pageRef.current.locator(selector).count();
    } catch {
      return 0;
    }
  }

  async hasClass(selector: string, className: string): Promise<boolean> {
    await this.waits.waitForElement(selector);
    return await this.pageRef.current
      .locator(selector)
      .evaluate((el: Element, cls: string) => el.classList.contains(cls), className);
  }

  async getAllClasses(selector: string): Promise<string[]> {
    await this.waits.waitForElement(selector);
    return await this.pageRef.current
      .locator(selector)
      .evaluate((el: Element) => Array.from(el.classList));
  }

  // ── Form controls ───────────────────────────────────────────────────────────

  async selectDropdownByValue(selector: string, value: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.selectOption(selector, { value });
  }

  async selectDropdownByText(selector: string, text: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.selectOption(selector, { label: text });
  }

  async selectItemInCustomDropdown(
    parentLocator: string,
    childLocator: string,
    expectedItem: string
  ): Promise<void> {
    await this.clickElement(parentLocator);
    await this.pageRef.current.waitForSelector(childLocator, { state: "attached" });
    const allItems = await this.pageRef.current.locator(childLocator).all();
    for (const item of allItems) {
      const itemText = await item.textContent();
      if (itemText?.trim() === expectedItem) {
        await item.scrollIntoViewIfNeeded();
        await item.click();
        break;
      }
    }
  }

  async isChecked(selector: string): Promise<boolean> {
    await this.waits.waitForElement(selector);
    return await this.pageRef.current.isChecked(selector);
  }

  async check(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.check(selector);
  }

  async uncheck(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.uncheck(selector);
  }

  // ── Hover / focus ───────────────────────────────────────────────────────────

  async hoverElement(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.hover(selector);
  }

  async focusElement(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.focus(selector);
  }

  async hoverAndGetTooltipAdvanced(
    selector: string,
    options: {
      tooltipSelector?: string;
      titleAttribute?: boolean;
      dataAttributes?: string[];
      ariaLabel?: boolean;
      timeout?: number;
      waitAfterHover?: number;
    } = {}
  ): Promise<string> {
    const {
      tooltipSelector,
      titleAttribute = true,
      dataAttributes = ["data-tooltip", "data-title", "data-original-title"],
      ariaLabel = true,
      timeout = TIMEOUTS.ELEMENT_VISIBLE,
      waitAfterHover = 500,
    } = options;

    await this.waits.waitForElement(selector);
    await this.pageRef.current.hover(selector);
    await this.waits.sleep(waitAfterHover);

    if (tooltipSelector) {
      try {
        await this.waits.waitForElement(tooltipSelector, timeout);
        const text = await this.getText(tooltipSelector);
        if (text.trim()) return text.trim();
      } catch {
        // try next strategy
      }
    }

    if (titleAttribute) {
      const titleText = await this.getAttribute(selector, "title");
      if (titleText?.trim()) return titleText.trim();
    }

    for (const dataAttr of dataAttributes) {
      const dataText = await this.getAttribute(selector, dataAttr);
      if (dataText?.trim()) return dataText.trim();
    }

    if (ariaLabel) {
      const ariaText = await this.getAttribute(selector, "aria-label");
      if (ariaText?.trim()) return ariaText.trim();
    }

    const commonTooltipSelectors = [
      ".tooltip", ".tooltip-inner", ".tooltip-content",
      ".popover", ".popover-content", ".popover-body",
      '[role="tooltip"]', ".ui-tooltip", ".tippy-content",
    ];
    for (const common of commonTooltipSelectors) {
      try {
        if (await this.isElementDisplayed(common)) {
          const text = await this.getText(common);
          if (text.trim()) return text.trim();
        }
      } catch {
        // continue
      }
    }

    return "";
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────

  async pressKey(key: string): Promise<void> {
    await this.pageRef.current.keyboard.press(key);
  }

  async pressKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.pageRef.current.keyboard.press(key);
    }
  }

  async selectAllText(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.focus(selector);
    await this.pageRef.current.keyboard.press("Control+A");
  }

  // ── Scroll ──────────────────────────────────────────────────────────────────

  async scrollToElement(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.pageRef.current.locator(selector).scrollIntoViewIfNeeded();
  }

  async scrollToTop(): Promise<void> {
    await this.pageRef.current.evaluate(() => window.scrollTo(0, 0));
  }

  async scrollToBottom(): Promise<void> {
    await this.pageRef.current.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async scrollByPixels(x: number, y: number): Promise<void> {
    await this.pageRef.current.evaluate(({ x, y }) => window.scrollBy(x, y), { x, y });
  }

  // ── Drag and drop ───────────────────────────────────────────────────────────

  async dragAndDrop(sourceSelector: string, targetSelector: string): Promise<void> {
    await this.waits.waitForElement(sourceSelector);
    await this.waits.waitForElement(targetSelector);
    await this.pageRef.current.dragAndDrop(sourceSelector, targetSelector);
  }

  // ── Locator-based operations ─────────────────────────────────────────────────
  // Use these when a dynamic or chained Locator cannot be expressed as a plain CSS/text selector.

  locator(selector: string): Locator {
    return this.pageRef.current.locator(selector);
  }

  async clickLocator(locator: Locator): Promise<void> {
    await locator.waitFor({ state: "visible", timeout: TIMEOUTS.ELEMENT_CLICKABLE });
    await locator.click();
  }

  async isLocatorVisible(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  async getLocatorAttribute(locator: Locator, attribute: string): Promise<string | null> {
    return locator.getAttribute(attribute);
  }
}

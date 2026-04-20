import { Page, Request, Response } from "@playwright/test";
import { TIMEOUTS } from "../../constants/timeouts";

/**
 * Centralises all page-readiness and synchronisation strategies.
 * Canonical wait hierarchy:
 *   1. waitForPageLoad()          – standard navigation gate (use this by default)
 *   2. waitForPageLoadState()     – explicit state control
 *   3. waitForNetworkIdle()       – standalone best-effort network quiet
 *   4. waitForCompletePageLoad()  – heavy-weight with images/fonts/AJAX options
 */
export class WaitHelper {
  constructor(private readonly page: Page) {}

  private getPageContext(): string {
    try {
      return this.page.url() || "(no URL yet)";
    } catch {
      return "(page context unavailable)";
    }
  }

  // ── Page-level waits ────────────────────────────────────────────────────────

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded", { timeout: TIMEOUTS.PAGE_LOAD });
    await this.page.waitForLoadState("load", { timeout: TIMEOUTS.PAGE_LOAD });
    try {
      await this.page.waitForLoadState("networkidle", { timeout: TIMEOUTS.PAGE_LOAD_FAST });
    } catch {
      console.warn(
        `⚠️  networkidle not reached after ${TIMEOUTS.PAGE_LOAD_FAST}ms; continuing. URL: ${this.getPageContext()}`
      );
    }
  }

  async waitForPageLoadState(
    state: "load" | "domcontentloaded" | "networkidle" = "networkidle",
    timeout: number = TIMEOUTS.PAGE_LOAD_SLOW
  ): Promise<void> {
    await this.page.waitForLoadState(state, { timeout });
  }

  async waitForNetworkIdle(timeout: number = TIMEOUTS.NETWORK_IDLE, throwOnTimeout: boolean = false): Promise<void> {
    try {
      await this.page.waitForLoadState("networkidle", { timeout });
    } catch {
      const msg = `⚠️  Network idle timeout after ${timeout}ms. URL: ${this.getPageContext()}`;
      console.warn(msg);
      if (throwOnTimeout) throw new Error(msg);
    }
  }

  async waitForCompletePageLoad(
    options: {
      waitForImages?: boolean;
      waitForFonts?: boolean;
      waitForAjax?: boolean;
      customSpinner?: string;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const {
      waitForImages = false,
      waitForFonts = false,
      waitForAjax = false,
      customSpinner,
      timeout = TIMEOUTS.TIMEOUT_LONG,
    } = options;

    await this.waitForPageLoad();

    if (customSpinner) {
      await this.waitForSpinnersToDisappear([customSpinner], timeout);
    }
    if (waitForImages) {
      await this.waitForAllImagesLoaded();
    }
    if (waitForFonts) {
      await this.page.waitForFunction(() => document.fonts.ready, { timeout: TIMEOUTS.TIMEOUT_MEDIUM });
    }
    if (waitForAjax) {
      await this.waitForAjaxRequestsComplete(timeout);
    }
    await this.waitForNetworkIdle();
  }

  // ── Element-level waits ─────────────────────────────────────────────────────

  async waitForElement(selector: string, timeout: number = TIMEOUTS.ELEMENT_VISIBLE): Promise<void> {
    await this.page.waitForSelector(selector, { state: "visible", timeout });
  }

  async waitForElementClickable(selector: string, timeout: number = TIMEOUTS.ELEMENT_CLICKABLE): Promise<void> {
    await this.page.waitForSelector(selector, { state: "attached", timeout });
  }

  async waitForElementText(
    selector: string,
    expectedText: string,
    timeout: number = TIMEOUTS.TIMEOUT_MEDIUM
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ selector, expectedText }) =>
        document.querySelector(selector)?.textContent?.includes(expectedText) ?? false,
      { selector, expectedText },
      { timeout }
    );
  }

  async waitForElementAttribute(
    selector: string,
    attribute: string,
    expectedValue: string,
    timeout: number = TIMEOUTS.TIMEOUT_MEDIUM
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ selector, attribute, expectedValue }) =>
        document.querySelector(selector)?.getAttribute(attribute) === expectedValue,
      { selector, attribute, expectedValue },
      { timeout }
    );
  }

  // ── URL waits ───────────────────────────────────────────────────────────────

  async waitForUrlContains(text: string, timeout: number = TIMEOUTS.TIMEOUT_MEDIUM): Promise<void> {
    await this.page.waitForURL((url) => url.toString().includes(text), { timeout });
  }

  async waitForUrlMatches(pattern: RegExp, timeout: number = TIMEOUTS.TIMEOUT_MEDIUM): Promise<void> {
    await this.page.waitForURL(pattern, { timeout });
  }

  // ── Network / AJAX waits ────────────────────────────────────────────────────

  async waitForAjaxRequest(
    urlPattern: string | RegExp,
    timeout: number = TIMEOUTS.TIMEOUT_LONG
  ): Promise<void> {
    try {
      await this.page.waitForResponse(
        (response) => {
          const url = response.url();
          return typeof urlPattern === "string"
            ? url.includes(urlPattern)
            : urlPattern.test(url);
        },
        { timeout }
      );
    } catch {
      const msg = `⚠️  Timeout waiting for AJAX request: ${urlPattern}`;
      console.warn(msg);
      throw new Error(msg);
    }
  }

  async waitForAjaxRequestsComplete(
    timeout: number = TIMEOUTS.TIMEOUT_LONG,
    excludeUrls: string[] = [],
    throwOnTimeout: boolean = false
  ): Promise<void> {
    const startTime = Date.now();
    const pending = new Set<string>();

    const onRequest = (req: Request) => {
      const url = req.url();
      const type = req.resourceType();
      if ((type === "xhr" || type === "fetch") && !excludeUrls.some((ex) => url.includes(ex))) {
        pending.add(url);
      }
    };
    const onResponse = (res: Response) => pending.delete(res.url());
    const onFailed = (req: Request) => pending.delete(req.url());

    this.page.on("request", onRequest);
    this.page.on("response", onResponse);
    this.page.on("requestfailed", onFailed);

    try {
      while (pending.size > 0) {
        if (Date.now() - startTime > timeout) {
          const pendingList = [...pending];
          const msg = `⚠️  AJAX timeout after ${timeout}ms. ${pendingList.length} request(s) pending. URL: ${this.getPageContext()}. Pending: ${pendingList.join(", ")}`;
          console.warn(msg);
          if (throwOnTimeout) throw new Error(msg);
          break;
        }
        await this.sleep(100);
      }
      await this.page.waitForLoadState("networkidle", { timeout: TIMEOUTS.TIMEOUT_SHORT }).catch(() => {});
    } finally {
      this.page.off("request", onRequest);
      this.page.off("response", onResponse);
      this.page.off("requestfailed", onFailed);
    }
  }

  // ── Asset waits ─────────────────────────────────────────────────────────────

  async waitForAllImagesLoaded(): Promise<void> {
    await this.page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete && img.naturalHeight !== 0),
      { timeout: TIMEOUTS.TIMEOUT_LONG }
    );
  }

  // ── Spinner waits ───────────────────────────────────────────────────────────

  async waitForSpinnersToDisappear(
    selectors: string[],
    timeout: number = TIMEOUTS.TIMEOUT_LONG
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      let visible = false;
      for (const selector of selectors) {
        try {
          const spinner = this.page.locator(selector);
          const count = await spinner.count();
          for (let i = 0; i < count; i++) {
            if (await spinner.nth(i).isVisible()) {
              visible = true;
              break;
            }
          }
        } catch {
          // element may not exist — treat as not visible
        }
      }
      if (!visible) return;
      await this.sleep(100);
    }
    console.warn("⚠️  Timeout waiting for spinners to disappear");
  }

  // ── Custom condition ────────────────────────────────────────────────────────

  async waitForCustomCondition(
    condition: () => Promise<boolean> | boolean,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const { timeout = TIMEOUTS.TIMEOUT_LONG, interval = 100 } = options;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        if (await condition()) return;
      } catch {
        // continue polling
      }
      await this.sleep(interval);
    }
    throw new Error(`Custom condition not met within ${timeout}ms`);
  }

  // ── Console waits ───────────────────────────────────────────────────────────

  async waitForConsoleMessage(messageText: string, timeout: number = TIMEOUTS.TIMEOUT_MEDIUM): Promise<void> {
    await this.page.waitForEvent("console", {
      predicate: (msg) => msg.text().includes(messageText),
      timeout,
    });
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  /** @internal Intentional pause — only use inside WaitHelper polling loops, never directly in tests or page objects. */
  async sleep(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }
}

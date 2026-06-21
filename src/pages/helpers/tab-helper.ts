import { Page } from "@playwright/test";
import { PageRef } from "./page-ref";

/** Window and tab management. Updates pageRef.current so all helpers follow the active tab. */
export class TabHelper {
  constructor(private readonly pageRef: PageRef) {}

  // ── Dialogs ─────────────────────────────────────────────────────────────────

  async acceptAlert(): Promise<void> {
    this.pageRef.current.once("dialog", (dialog) => dialog.accept());
  }

  async dismissAlert(): Promise<void> {
    this.pageRef.current.once("dialog", (dialog) => dialog.dismiss());
  }

  // ── Tab / window switching ───────────────────────────────────────────────────

  async switchToWindowByTitle(expectedTitle: string): Promise<void> {
    for (const pg of this.pageRef.current.context().pages()) {
      if ((await pg.title()) === expectedTitle) {
        this.pageRef.current = pg;
        await pg.bringToFront();
        break;
      }
    }
  }

  async switchToWindowById(parentPage: Page): Promise<void> {
    for (const pg of this.pageRef.current.context().pages()) {
      if (pg !== parentPage) {
        this.pageRef.current = pg;
        await pg.bringToFront();
        break;
      }
    }
  }

  async switchToWindowByIndex(index: number): Promise<void> {
    const allPages = this.pageRef.current.context().pages();
    if (index < 0 || index >= allPages.length) {
      throw new Error(`Window index ${index} out of range. Available: ${allPages.length}`);
    }
    this.pageRef.current = allPages[index];
    await this.pageRef.current.bringToFront();
  }

  async switchToWindowByUrl(urlPattern: string | RegExp): Promise<boolean> {
    for (const pg of this.pageRef.current.context().pages()) {
      const url = pg.url();
      const match =
        typeof urlPattern === "string" ? url.includes(urlPattern) : urlPattern.test(url);
      if (match) {
        this.pageRef.current = pg;
        await pg.bringToFront();
        return true;
      }
    }
    return false;
  }

  async switchToLatestWindow(): Promise<void> {
    const allPages = this.pageRef.current.context().pages();
    if (allPages.length > 0) {
      this.pageRef.current = allPages[allPages.length - 1];
      await this.pageRef.current.bringToFront();
    }
  }

  async closeAllWindowsWithoutParent(parentPage: Page): Promise<void> {
    for (const pg of this.pageRef.current.context().pages()) {
      if (pg !== parentPage) await pg.close();
    }
    this.pageRef.current = parentPage;
    await parentPage.bringToFront();
  }

  async closeCurrentWindowAndSwitchToParent(parentPage: Page): Promise<void> {
    const current = this.pageRef.current;
    this.pageRef.current = parentPage;
    await parentPage.bringToFront();
    await current.close();
  }

  async closeAllTabsExceptCurrent(): Promise<void> {
    const current = this.pageRef.current;
    for (const pg of this.pageRef.current.context().pages()) {
      if (pg !== current) await pg.close();
    }
  }

  async waitForNewWindowAndSwitch(timeout = 10000): Promise<void> {
    const newPage = await this.pageRef.current.context().waitForEvent("page", { timeout });
    this.pageRef.current = newPage;
    await newPage.bringToFront();
    await newPage.waitForLoadState("domcontentloaded");
  }

  async openNewTab(url?: string): Promise<void> {
    const newPage = await this.pageRef.current.context().newPage();
    if (url) await newPage.goto(url);
    this.pageRef.current = newPage;
    await newPage.bringToFront();
  }

  // ── Window queries ───────────────────────────────────────────────────────────

  async getWindowCount(): Promise<number> {
    return this.pageRef.current.context().pages().length;
  }

  async getAllWindowTitles(): Promise<string[]> {
    const titles: string[] = [];
    for (const pg of this.pageRef.current.context().pages()) {
      titles.push(await pg.title());
    }
    return titles;
  }
}

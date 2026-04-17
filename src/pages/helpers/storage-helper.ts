import { Page } from "@playwright/test";

/** Browser storage: cookies, localStorage, sessionStorage, and cache clearing. */
export class StorageHelper {
  constructor(private readonly page: Page) {}

  // ── Cookies ─────────────────────────────────────────────────────────────────

  async getAllCookies() {
    return await this.page.context().cookies();
  }

  async addCookie(name: string, value: string, domain?: string): Promise<void> {
    await this.page.context().addCookies([
      {
        name,
        value,
        domain: domain ?? new URL(this.page.url()).hostname,
        path: "/",
      },
    ]);
  }

  async deleteAllCookies(): Promise<void> {
    await this.page.context().clearCookies();
  }

  // ── localStorage ────────────────────────────────────────────────────────────

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }

  // ── sessionStorage ──────────────────────────────────────────────────────────

  async getSessionStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => sessionStorage.getItem(k), key);
  }

  async setSessionStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => sessionStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  // ── Cache ───────────────────────────────────────────────────────────────────

  async clearBrowserCache(): Promise<void> {
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  // ── Clipboard ───────────────────────────────────────────────────────────────

  async copyToClipboard(text: string): Promise<void> {
    await this.page.evaluate((t) => navigator.clipboard.writeText(t), text);
  }

  async getClipboardText(): Promise<string> {
    return await this.page.evaluate(() => navigator.clipboard.readText());
  }
}

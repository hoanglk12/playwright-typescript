import { Cookie } from "@playwright/test";
import { PageRef } from "./page-ref";

/** Browser storage: cookies, localStorage, sessionStorage, and cache clearing. */
export class StorageHelper {
  constructor(private readonly pageRef: PageRef) {}

  // ── Cookies ─────────────────────────────────────────────────────────────────

  async getAllCookies(): Promise<Cookie[]> {
    return await this.pageRef.current.context().cookies();
  }

  async addCookie(name: string, value: string, domain?: string): Promise<void> {
    await this.pageRef.current.context().addCookies([
      {
        name,
        value,
        domain: domain ?? new URL(this.pageRef.current.url()).hostname,
        path: "/",
      },
    ]);
  }

  async deleteAllCookies(): Promise<void> {
    await this.pageRef.current.context().clearCookies();
  }

  // ── localStorage ────────────────────────────────────────────────────────────

  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.pageRef.current.evaluate((k) => localStorage.getItem(k), key);
  }

  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.pageRef.current.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  async clearLocalStorage(): Promise<void> {
    await this.pageRef.current.evaluate(() => localStorage.clear());
  }

  // ── sessionStorage ──────────────────────────────────────────────────────────

  async getSessionStorageItem(key: string): Promise<string | null> {
    return await this.pageRef.current.evaluate((k) => sessionStorage.getItem(k), key);
  }

  async setSessionStorageItem(key: string, value: string): Promise<void> {
    await this.pageRef.current.evaluate(
      ({ k, v }) => sessionStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  // ── Cache ───────────────────────────────────────────────────────────────────

  async clearBrowserCache(): Promise<void> {
    await this.pageRef.current.context().clearCookies();
    await this.pageRef.current.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  // ── Clipboard ───────────────────────────────────────────────────────────────

  async copyToClipboard(text: string): Promise<void> {
    await this.pageRef.current.evaluate((t) => navigator.clipboard.writeText(t), text);
  }

  async getClipboardText(): Promise<string> {
    return await this.pageRef.current.evaluate(() => navigator.clipboard.readText());
  }
}

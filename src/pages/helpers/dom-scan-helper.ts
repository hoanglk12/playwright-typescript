import { PageRef } from './page-ref';

/**
 * Focused DOM inspection methods for querying element state without throwing.
 * All methods return falsy/empty on missing elements rather than throwing.
 */
export class DomScanHelper {
  constructor(private readonly pageRef: PageRef) {}

  async hasAnyVisible(selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      try {
        const el = this.pageRef.current.locator(selector).first();
        if (await el.isVisible()) return true;
      } catch {
        // element not found or not visible
      }
    }
    return false;
  }

  async firstVisible(selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const el = this.pageRef.current.locator(selector).first();
        if (await el.isVisible()) return selector;
      } catch {
        // not found
      }
    }
    return null;
  }

  async getAllTextContents(selector: string): Promise<string[]> {
    try {
      const texts = await this.pageRef.current.locator(selector).allTextContents();
      return texts.map((t) => t.trim());
    } catch {
      return [];
    }
  }

  /** Filters out elements where the attribute is absent. */
  async getAllAttributes(selector: string, attribute: string): Promise<string[]> {
    try {
      const locator = this.pageRef.current.locator(selector);
      const count = await locator.count();
      const results: string[] = [];
      for (let i = 0; i < count; i++) {
        const val = await locator.nth(i).getAttribute(attribute);
        if (val !== null) results.push(val);
      }
      return results;
    } catch {
      return [];
    }
  }

  /** @param exact Set false for a partial (substring) match. */
  async hasAriaLabel(selector: string, expected: string, exact = true): Promise<boolean> {
    try {
      const val = await this.pageRef.current.locator(selector).first().getAttribute('aria-label');
      if (val === null) return false;
      return exact ? val === expected : val.includes(expected);
    } catch {
      return false;
    }
  }

  async safeGetText(selector: string): Promise<string> {
    try {
      const el = this.pageRef.current.locator(selector).first();
      if (!(await el.isVisible())) return '';
      return (await el.innerText()).trim();
    } catch {
      return '';
    }
  }

  async count(selector: string): Promise<number> {
    try {
      return await this.pageRef.current.locator(selector).count();
    } catch {
      return 0;
    }
  }
}

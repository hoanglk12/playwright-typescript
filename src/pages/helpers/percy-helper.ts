import { Page } from "@playwright/test";
import percySnapshot from "@percy/playwright";

export interface PercySnapshotOptions {
  widths?: number[];
  minHeight?: number;
  percyCSS?: string;
  enableJavaScript?: boolean;
  /** CSS selector to scope the snapshot to a single element */
  scope?: string;
}

/**
 * Wraps Percy visual snapshots with a token-guard so tests run safely
 * when PERCY_TOKEN is absent (local runs, non-visual CI pipelines).
 */
export class PercyHelper {
  private readonly enabled: boolean;

  constructor(private readonly page: Page) {
    this.enabled = !!process.env.PERCY_TOKEN;
  }

  // ── Snapshots ───────────────────────────────────────────────────────────────

  async snapshot(name: string, options: PercySnapshotOptions = {}): Promise<void> {
    if (!this.enabled) return;
    try {
      await percySnapshot(this.page, name, options);
    } catch (err) {
      console.warn(`⚠️  Percy snapshot failed for "${name}": ${err}`);
    }
  }

  /** Snapshot a scoped element by CSS selector. */
  async snapshotElement(name: string, selector: string, options: PercySnapshotOptions = {}): Promise<void> {
    await this.snapshot(name, { ...options, scope: selector });
  }

  /** Snapshot the same state at multiple explicit widths, overriding percy.yml defaults. */
  async snapshotResponsive(
    name: string,
    widths: number[] = [360, 375, 768, 1440, 1512, 1920],
    options: PercySnapshotOptions = {}
  ): Promise<void> {
    await this.snapshot(name, { ...options, widths });
  }

  // ── State ───────────────────────────────────────────────────────────────────

  get isEnabled(): boolean {
    return this.enabled;
  }
}

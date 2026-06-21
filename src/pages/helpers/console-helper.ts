import { Page } from '@playwright/test';

export interface ConsoleMessage {
  type: 'log' | 'warning' | 'error' | 'info' | 'debug';
  text: string;
  url?: string;
  timestamp: number;
}

export interface ConsoleHelperOptions {
  failOnErrors?: boolean;
  ignorePatterns?: RegExp[];
  captureTypes?: ConsoleMessage['type'][];
}

/**
 * Collects browser console messages during tests.
 * Default: warn on unexpected errors (does not fail test).
 * Set failOnErrors: true to throw on any captured error messages at teardown.
 *
 * NOTE: This is a test fixture, not a BasePage helper. It uses Page directly
 * and does not participate in tab switching.
 */
export class ConsoleHelper {
  private readonly messages: ConsoleMessage[] = [];
  private readonly options: Required<ConsoleHelperOptions>;

  constructor(private readonly page: Page, options: ConsoleHelperOptions = {}) {
    this.options = {
      failOnErrors: false,
      ignorePatterns: [],
      captureTypes: ['log', 'warning', 'error', 'info', 'debug'],
      ...options,
    };
    this.attach();
  }

  private attach(): void {
    this.page.on('console', (msg) => {
      const type = msg.type() as ConsoleMessage['type'];
      if (!this.options.captureTypes.includes(type)) return;
      const text = msg.text();
      if (this.options.ignorePatterns.some((p) => p.test(text))) return;
      this.messages.push({ type, text, url: msg.location().url, timestamp: Date.now() });
    });
  }

  getMessages(type?: ConsoleMessage['type']): ConsoleMessage[] {
    return type ? this.messages.filter((m) => m.type === type) : [...this.messages];
  }

  getErrors(): ConsoleMessage[] { return this.getMessages('error'); }
  getWarnings(): ConsoleMessage[] { return this.getMessages('warning'); }
  hasErrors(): boolean { return this.getErrors().length > 0; }
  clear(): void { this.messages.length = 0; }

  /**
   * Call at test teardown. In warn mode: logs errors to console but does not throw.
   * In failOnErrors mode: throws if any error messages were captured.
   */
  async summarize(testName: string): Promise<void> {
    const errors = this.getErrors();
    if (errors.length === 0) return;
    const summary = errors.map((e) => `  [${e.type}] ${e.text}`).join('\n');
    if (this.options.failOnErrors) {
      throw new Error(`Console errors in "${testName}":\n${summary}`);
    } else {
      console.warn(`[ConsoleHelper] ${errors.length} console error(s) in "${testName}":\n${summary}`);
    }
  }
}

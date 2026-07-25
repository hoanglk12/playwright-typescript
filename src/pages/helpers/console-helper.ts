import { Page } from '@playwright/test';
import { redactConsoleText } from '../../utils/redact';

export interface ConsoleMessage {
  type: 'log' | 'warning' | 'error' | 'info' | 'debug';
  text: string;
  url?: string;
  timestamp: number;
}

export interface PageFailureEvent {
  type: 'pageerror' | 'requestfailed';
  text: string;
  timestamp: number;
}

export interface ConsoleHelperOptions {
  ignorePatterns?: RegExp[];
  captureTypes?: ConsoleMessage['type'][];
}

// Chromium and Firefox report the same test-inflicted abort condition (route-block, or the
// Firefox about:blank teardown navigation cancelling in-flight requests) under different
// error strings.
const ABORT_ERROR_SIGNATURES = ['ERR_ABORTED', 'NS_BINDING_ABORTED'];

/**
 * Collects browser console messages, page errors, and failed requests during tests.
 * As an auto-fixture (see `consoleHelper` in `base-test.ts`), captured output is rendered
 * via `buildFailureReport()` and attached only when the test fails.
 *
 * NOTE: This is a test fixture, not a BasePage helper. It uses Page directly
 * and does not participate in tab switching.
 */
export class ConsoleHelper {
  private readonly messages: ConsoleMessage[] = [];
  private readonly pageFailures: PageFailureEvent[] = [];
  private readonly options: Required<ConsoleHelperOptions>;

  constructor(private readonly page: Page, options: ConsoleHelperOptions = {}) {
    this.options = {
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

    this.page.on('pageerror', (error) => {
      this.pageFailures.push({ type: 'pageerror', text: error.stack ?? error.message, timestamp: Date.now() });
    });

    this.page.on('requestfailed', (request) => {
      const failure = request.failure();
      const reason = failure ? failure.errorText : 'unknown reason';
      // Route-block aborts (applyNoiseRouteBlocks) and the Firefox about:blank teardown
      // navigation both surface here as test-inflicted aborts, not real failures — Chromium
      // reports ERR_ABORTED, Firefox reports NS_BINDING_ABORTED for the same condition.
      if (ABORT_ERROR_SIGNATURES.some((signature) => reason.includes(signature))) return;
      this.pageFailures.push({
        type: 'requestfailed',
        text: `${request.method()} ${request.url()} — ${reason}`,
        timestamp: Date.now(),
      });
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
   * Renders captured console errors/warnings and page-error/failed-request events as
   * redacted plain text, for attachment on test failure. Returns empty string when nothing
   * was captured, so callers can skip attaching entirely.
   */
  buildFailureReport(): string {
    const consoleLines = this.messages
      .filter((m) => m.type === 'error' || m.type === 'warning')
      .map((m) => `[console:${m.type}] ${m.text}`);
    const failureLines = this.pageFailures.map((f) => `[${f.type}] ${f.text}`);
    const lines = [...consoleLines, ...failureLines];
    if (lines.length === 0) return '';
    return lines.map((line) => redactConsoleText(line)).join('\n');
  }
}

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { redactSensitiveText } from './redact';

export class TestLogger {
  private testTitle: string;
  private stepCounter: number = 0;
  private buffer: string[] = [];
  private static logDir: string = './test-logs';
  private static logFile: string = path.join(TestLogger.logDir, 'test-execution.log');
  // Keyed by testInfo.testId — lets the per-test attach fixture in base-test.ts /
  // ApiTest.ts find the logger(s) created ad-hoc via createTestLogger() inside a spec body.
  // Known limitation: a logger created inside test.beforeAll() registers under a testId
  // the per-test attach fixture never consumes (attachTestLogs is test-scoped, not run for
  // beforeAll) — that entry is never flushed to an attachment and stays in this map for the
  // life of the worker process. Bounded to one entry per spec file per worker; setup logs
  // created this way remain visible in the shared test-logs/test-execution.log as before.
  private static registry: Map<string, TestLogger[]> = new Map();

  private static formatTimestamp(date: Date = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ` +
           `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  }

  constructor(testTitle: string) {
    this.testTitle = testTitle;
  }

  /**
   * Clear all logs - used in global setup
   */
  static clearLogs(): void {
    try {
      // Clear console (if running in terminal)
      if (process.stdout.isTTY) {
        console.clear();
      }

      // Ensure log directory exists
      if (!fs.existsSync(TestLogger.logDir)) {
        fs.mkdirSync(TestLogger.logDir, { recursive: true });
      }

      // Clear log file
      if (fs.existsSync(TestLogger.logFile)) {
        fs.writeFileSync(TestLogger.logFile, '');
      }

      // Clear any existing log files in the directory
      const logFiles = fs.readdirSync(TestLogger.logDir).filter(file => 
        file.endsWith('.log') || file.endsWith('.txt')
      );

      logFiles.forEach(file => {
        const filePath = path.join(TestLogger.logDir, file);
        fs.writeFileSync(filePath, '');
      });

      console.log('🧹 Logs cleared successfully');
      
    } catch (error) {
      console.error('❌ Failed to clear logs:', error);
    }
  }

  /**
   * Initialize logging session - called at start of test run
   */
  static initializeLogging(): void {
    const timestamp = TestLogger.formatTimestamp();
    const sessionHeader = `
=================================================================
🚀 TEST EXECUTION STARTED
📅 Timestamp: ${timestamp}
🏗️  Framework: Playwright
=================================================================

`;

    // Ensure log directory exists
    if (!fs.existsSync(TestLogger.logDir)) {
      fs.mkdirSync(TestLogger.logDir, { recursive: true });
    }

    // Write session header to log file
    fs.writeFileSync(TestLogger.logFile, sessionHeader);
    console.log(sessionHeader);
  }

  /**
   * Log a test step with automatic step numbering.
   *
   * Two call forms (backward compatible — existing marker-style calls are unaffected):
   *  - `step(message, data?)` — marker-style. Logs to console/file/buffer only, as before.
   *  - `step(message, body)` — callback-style (Phase 2). Also wraps `body` in Playwright's
   *    native `test.step()`, so the step becomes a real timed node in the HTML report,
   *    trace viewer, and monocart tree grid, in addition to the existing log line. The
   *    callback's rejection propagates untouched — a failing assertion inside `body` still
   *    fails the test.
   */
  step(message: string, body: () => Promise<void>): Promise<void>;
  step(message: string, data?: any): void;
  step(message: string, dataOrBody?: any): void | Promise<void> {
    if (typeof dataOrBody === 'function') {
      return test.step(message, async () => {
        this.logStepLine(message);
        await dataOrBody();
      });
    }

    this.logStepLine(message, dataOrBody);
  }

  /**
   * Shared step log-line formatting/emission, used by both call forms of `step()`.
   */
  private logStepLine(message: string, data?: any): void {
    this.stepCounter++;
    const timestamp = TestLogger.formatTimestamp();
    const logMessage = `[${timestamp}] Step ${this.stepCounter}: ${message}`;

    console.log(`🔍 ${logMessage}`);
    this.writeToFile(`🔍 ${logMessage}`);

    if (data) {
      const dataLog = `   📊 Data: ${JSON.stringify(data, null, 2)}`;
      console.log(dataLog);
      this.writeToFile(dataLog);
    }
  }

  /**
   * Log an action being performed
   */
  action(action: string, target?: string): void {
    const timestamp = TestLogger.formatTimestamp();
    const message = target ? `${action} on ${target}` : action;
    const logMessage = `⚡ [${timestamp}] Action: ${message}`;
    
    console.log(logMessage);
    this.writeToFile(logMessage);
  }

  /**
   * Log an assertion/verification
   */
  verify(verification: string, expected?: any, actual?: any, isSoft?: boolean): void {
    const timestamp = TestLogger.formatTimestamp();
    const prefix = isSoft ? '🔵 [SOFT]' : '✅';
    const logMessage = `${prefix} [${timestamp}] Verify: ${verification}`;

    console.log(logMessage);
    this.writeToFile(logMessage);

    if (expected !== undefined && actual !== undefined) {
      const expectedLog = `   Expected: ${JSON.stringify(expected)}`;
      const actualLog = `   Actual: ${JSON.stringify(actual)}`;
      console.log(expectedLog);
      console.log(actualLog);
      this.writeToFile(expectedLog);
      this.writeToFile(actualLog);
    }
  }

  /**
   * Log an error or issue
   */
  error(error: string, details?: any): void {
    const timestamp = TestLogger.formatTimestamp();
    const logMessage = `❌ [${timestamp}] Error: ${error}`;
    
    console.error(logMessage);
    this.writeToFile(logMessage);
    
    if (details) {
      const detailsLog = `   Details: ${JSON.stringify(details, null, 2)}`;
      console.error(detailsLog);
      this.writeToFile(detailsLog);
    }
  }

  /**
   * Log test information
   */
  info(message: string, data?: any): void {
    const timestamp = TestLogger.formatTimestamp();
    const logMessage = `ℹ️  [${timestamp}] Info: ${message}`;
    
    console.log(logMessage);
    this.writeToFile(logMessage);
    
    if (data) {
      const dataLog = `   Data: ${JSON.stringify(data, null, 2)}`;
      console.log(dataLog);
      this.writeToFile(dataLog);
    }
  }

  /**
   * Log test completion
   */
  complete(status: 'passed' | 'failed', duration?: number): void {
    const timestamp = TestLogger.formatTimestamp();
    const emoji = status === 'passed' ? '✅' : '❌';
    const durationText = duration ? ` (${duration}ms)` : '';
    
    const statusLog = `${emoji} [${timestamp}] Test ${status}: ${this.testTitle}${durationText}`;
    const stepsLog = `   Total steps executed: ${this.stepCounter}`;
    
    console.log(statusLog);
    console.log(stepsLog);
    this.writeToFile(statusLog);
    this.writeToFile(stepsLog);
    this.writeToFile('-----------------------------------');
  }

  /**
   * Write log message to file (and buffer for per-test attachment). Redacted here — this is
   * the single choke point feeding both the shared, CI-artifact-uploaded log file and the
   * per-test attachment deployed to public report sites, so a spec logging a value by name
   * (e.g. `logger.verify('Customer email', testEmail, ...)`) can't leak it to either.
   */
  private writeToFile(message: string): void {
    const redacted = redactSensitiveText(message);
    this.buffer.push(redacted);

    try {
      if (!fs.existsSync(TestLogger.logDir)) {
        fs.mkdirSync(TestLogger.logDir, { recursive: true });
      }
      fs.appendFileSync(TestLogger.logFile, redacted + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Return this logger's captured lines as a single string, for per-test attachment
   */
  getBuffer(): string {
    return this.buffer.join('\n');
  }

  /**
   * Register this instance against the currently running test's testId so the
   * per-test attach fixture (base-test.ts / ApiTest.ts) can retrieve it at teardown.
   * Called by createTestLogger(); not intended for direct use elsewhere.
   */
  registerForCurrentTest(): void {
    try {
      const testId = test.info().testId;
      const existing = TestLogger.registry.get(testId) ?? [];
      existing.push(this);
      TestLogger.registry.set(testId, existing);
    } catch {
      // Not running inside an active Playwright test — nothing to register.
    }
  }

  /**
   * Join and remove all buffers registered for a given testId. Called once by the
   * per-test attach fixture; clearing avoids stale content leaking into retries.
   */
  static consumeBuffer(testId: string): string {
    const loggers = TestLogger.registry.get(testId);
    TestLogger.registry.delete(testId);
    if (!loggers || loggers.length === 0) {
      return '';
    }
    return loggers.map(logger => logger.getBuffer()).join('\n');
  }
}

/**
 * Create a logger instance for a test
 */
export function createTestLogger(testTitle: string): TestLogger {
  const logger = new TestLogger(testTitle);
  logger.registerForCurrentTest();
  return logger;
}
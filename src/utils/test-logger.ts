import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export class TestLogger {
  private testTitle: string;
  private stepCounter: number = 0;
  private static logDir: string = './test-logs';
  private static logFile: string = path.join(TestLogger.logDir, 'test-execution.log');

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
    const timestamp = new Date().toISOString();
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
   * Log a test step with automatic step numbering
   */
  step(message: string, data?: any): void {
    this.stepCounter++;
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] Step ${this.stepCounter}: ${message}`;
    
    console.log(`🔍 ${logMessage}`);
    this.writeToFile(`🔍 ${logMessage}`);
    
    if (data) {
      const dataLog = `   📊 Data: ${JSON.stringify(data, null, 2)}`;
      console.log(dataLog);
      this.writeToFile(dataLog);
    }

    // Add to Playwright's test info for better reporting
    test.info().annotations.push({
      type: 'step',
      description: `Step ${this.stepCounter}: ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`
    });
  }

  /**
   * Log an action being performed
   */
  action(action: string, target?: string): void {
    const timestamp = new Date().toISOString();
    const message = target ? `${action} on ${target}` : action;
    const logMessage = `⚡ [${timestamp}] Action: ${message}`;
    
    console.log(logMessage);
    this.writeToFile(logMessage);
    
    test.info().annotations.push({
      type: 'action',
      description: message
    });
  }

  /**
   * Log an assertion/verification
   */
  verify(verification: string, expected?: any, actual?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `✅ [${timestamp}] Verify: ${verification}`;
    
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

    test.info().annotations.push({
      type: 'verification',
      description: `${verification}${expected !== undefined ? ` | Expected: ${JSON.stringify(expected)}` : ''}`
    });
  }

  /**
   * Log an error or issue
   */
  error(error: string, details?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `❌ [${timestamp}] Error: ${error}`;
    
    console.error(logMessage);
    this.writeToFile(logMessage);
    
    if (details) {
      const detailsLog = `   Details: ${JSON.stringify(details, null, 2)}`;
      console.error(detailsLog);
      this.writeToFile(detailsLog);
    }

    test.info().annotations.push({
      type: 'error',
      description: `${error}${details ? ` | Details: ${JSON.stringify(details)}` : ''}`
    });
  }

  /**
   * Log test information
   */
  info(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logMessage = `ℹ️  [${timestamp}] Info: ${message}`;
    
    console.log(logMessage);
    this.writeToFile(logMessage);
    
    if (data) {
      const dataLog = `   Data: ${JSON.stringify(data, null, 2)}`;
      console.log(dataLog);
      this.writeToFile(dataLog);
    }

    test.info().annotations.push({
      type: 'info',
      description: `${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}`
    });
  }

  /**
   * Log test completion
   */
  complete(status: 'passed' | 'failed', duration?: number): void {
    const timestamp = new Date().toISOString();
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
   * Write log message to file
   */
  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(TestLogger.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }
}

/**
 * Create a logger instance for a test
 */
export function createTestLogger(testTitle: string): TestLogger {
  return new TestLogger(testTitle);
}
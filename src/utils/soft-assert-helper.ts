import { expect, type Locator } from '@playwright/test';
import { type TestLogger } from './test-logger';

export class SoftAssertHelper {
  constructor(private readonly logger: TestLogger) {}

  toBe(actual: unknown, expected: unknown, message?: string): void {
    this.logger.verify(message ?? `Value should be ${String(expected)}`, expected, actual, true);
    expect.soft(actual, message).toBe(expected);
  }

  toEqual(actual: unknown, expected: unknown, message?: string): void {
    this.logger.verify(message ?? `Value should equal ${JSON.stringify(expected)}`, expected, actual, true);
    expect.soft(actual, message).toStrictEqual(expected);
  }

  toContain(actual: string | unknown[], expected: unknown, message?: string): void {
    this.logger.verify(message ?? `Value should contain ${String(expected)}`, expected, actual, true);
    expect.soft(actual, message).toContain(expected);
  }

  toMatch(actual: string, pattern: string | RegExp, message?: string): void {
    this.logger.verify(message ?? `Value should match ${String(pattern)}`, String(pattern), actual, true);
    expect.soft(actual, message).toMatch(pattern);
  }

  toBeTruthy(actual: unknown, message?: string): void {
    this.logger.verify(message ?? 'Value should be truthy', true, actual, true);
    expect.soft(actual, message).toBeTruthy();
  }

  toBeFalsy(actual: unknown, message?: string): void {
    this.logger.verify(message ?? 'Value should be falsy', false, actual, true);
    expect.soft(actual, message).toBeFalsy();
  }

  toBeNull(actual: unknown, message?: string): void {
    this.logger.verify(message ?? 'Value should be null', null, actual, true);
    expect.soft(actual, message).toBeNull();
  }

  toBeDefined(actual: unknown, message?: string): void {
    this.logger.verify(message ?? 'Value should be defined', 'defined', actual, true);
    expect.soft(actual, message).toBeDefined();
  }

  toBeGreaterThan(actual: number, expected: number, message?: string): void {
    this.logger.verify(message ?? `Value should be > ${expected}`, `> ${expected}`, actual, true);
    expect.soft(actual, message).toBeGreaterThan(expected);
  }

  toBeLessThan(actual: number, expected: number, message?: string): void {
    this.logger.verify(message ?? `Value should be < ${expected}`, `< ${expected}`, actual, true);
    expect.soft(actual, message).toBeLessThan(expected);
  }

  toHaveLength(actual: string | unknown[], expected: number, message?: string): void {
    this.logger.verify(message ?? `Collection should have length ${expected}`, expected, (actual as { length: number }).length, true);
    expect.soft(actual, message).toHaveLength(expected);
  }

  async toBeVisible(locator: Locator, message?: string): Promise<void> {
    this.logger.verify(message ?? 'Element should be visible', 'visible', locator.toString(), true);
    await expect.soft(locator, message).toBeVisible();
  }

  async toHaveText(locator: Locator, expected: string | RegExp, message?: string): Promise<void> {
    this.logger.verify(message ?? `Element should have text ${String(expected)}`, String(expected), locator.toString(), true);
    await expect.soft(locator, message).toHaveText(expected);
  }
}

export function createSoftAssertHelper(logger: TestLogger): SoftAssertHelper {
  return new SoftAssertHelper(logger);
}

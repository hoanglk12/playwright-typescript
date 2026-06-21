import { FrameLocator } from "@playwright/test";
import { PageRef } from "./page-ref";

/**
 * Modern iframe helpers using Playwright's frameLocator API.
 * The legacy switchToFrame / contentFrame pattern has been removed —
 * frameLocator composes cleanly with locators and handles retries automatically.
 */
export class FrameHelper {
  constructor(private readonly pageRef: PageRef) {}

  /** Returns a FrameLocator for chaining further locator calls. */
  locator(frameSelector: string): FrameLocator {
    return this.pageRef.current.frameLocator(frameSelector);
  }

  async click(frameSelector: string, elementSelector: string): Promise<void> {
    await this.pageRef.current.frameLocator(frameSelector).locator(elementSelector).click();
  }

  async fill(frameSelector: string, elementSelector: string, text: string): Promise<void> {
    await this.pageRef.current.frameLocator(frameSelector).locator(elementSelector).fill(text);
  }

  async getText(frameSelector: string, elementSelector: string): Promise<string> {
    return (
      (await this.pageRef.current
        .frameLocator(frameSelector)
        .locator(elementSelector)
        .textContent()) ?? ""
    );
  }

  async isVisible(frameSelector: string, elementSelector: string): Promise<boolean> {
    try {
      return await this.pageRef.current
        .frameLocator(frameSelector)
        .locator(elementSelector)
        .isVisible();
    } catch {
      return false;
    }
  }
}

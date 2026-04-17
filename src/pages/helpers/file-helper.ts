import { Page } from "@playwright/test";
import { WaitHelper } from "./wait-helper";

/** File upload and drag-and-drop file operations. */
export class FileHelper {
  constructor(
    private readonly page: Page,
    private readonly waits: WaitHelper
  ) {}

  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.page.setInputFiles(selector, filePath);
  }

  async uploadMultipleFiles(selector: string, filePaths: string[]): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.page.setInputFiles(selector, filePaths);
  }

  async clearUploadedFiles(selector: string): Promise<void> {
    await this.waits.waitForElement(selector);
    await this.page.setInputFiles(selector, []);
  }

  async uploadFileWithVerification(selector: string, filePath: string): Promise<boolean> {
    try {
      await this.waits.waitForElement(selector);
      await this.page.setInputFiles(selector, filePath);
      const value = await this.page.inputValue(selector);
      return value.length > 0;
    } catch {
      return false;
    }
  }

  async getUploadedFileNames(selector: string): Promise<string[]> {
    try {
      await this.waits.waitForElement(selector);
      return await this.page.evaluate((sel: string): string[] => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el?.type === "file" && el.files) {
          return Array.from(el.files).map((f) => f.name);
        }
        return [];
      }, selector);
    } catch (error) {
      console.warn(`Failed to get uploaded file names for selector: ${selector}`, error);
      return [];
    }
  }

  async getAcceptedFileTypes(selector: string): Promise<string | null> {
    await this.waits.waitForElement(selector);
    return await this.page.getAttribute(selector, "accept");
  }

  /** Sets files on an <input type="file"> element via a locator. */
  async dragAndDropFile(filePath: string, uploadFileSelector: string): Promise<void> {
    await this.waits.waitForElementClickable(uploadFileSelector);
    await this.page.locator(uploadFileSelector).setInputFiles(filePath);
  }
}

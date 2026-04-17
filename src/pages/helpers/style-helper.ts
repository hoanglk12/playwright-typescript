import { Page } from "@playwright/test";
import { WaitHelper } from "./wait-helper";

/** Computed-style helpers: color conversion, dimensions, CSS property reads. */
export class StyleHelper {
  constructor(
    private readonly page: Page,
    private readonly waits: WaitHelper
  ) {}

  // ── Color conversion ────────────────────────────────────────────────────────

  rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number): string => {
      const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
  }

  convertColorToHex(colorString: string): string {
    const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return this.rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
    }

    const rgbaMatch = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (rgbaMatch) {
      return this.rgbToHex(+rgbaMatch[1], +rgbaMatch[2], +rgbaMatch[3]);
    }

    if (colorString === "transparent" || colorString === "rgba(0, 0, 0, 0)") return "transparent";
    if (/^#[0-9a-f]{6}$/i.test(colorString)) return colorString.toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(colorString)) return `#${colorString.toLowerCase()}`;
    return colorString;
  }

  // ── Color reads ─────────────────────────────────────────────────────────────

  async getElementBackgroundColorHex(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    const color = await this.page
      .locator(selector)
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    return this.convertColorToHex(color);
  }

  async getAllElementsBackgroundColorHex(selector: string): Promise<string[]> {
    const elements = await this.page.locator(selector).all();
    const colors: string[] = [];
    for (const el of elements) {
      const color = await el.evaluate((e) => window.getComputedStyle(e).backgroundColor);
      colors.push(this.convertColorToHex(color));
    }
    return colors;
  }

  async getElementTextColorHex(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    const color = await this.page
      .locator(selector)
      .evaluate((el) => window.getComputedStyle(el).color);
    return this.convertColorToHex(color);
  }

  async getElementBorderColorHex(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    const color = await this.page
      .locator(selector)
      .evaluate((el) => window.getComputedStyle(el).borderColor);
    return this.convertColorToHex(color);
  }

  async getCSSProperty(selector: string, property: string): Promise<string> {
    await this.waits.waitForElement(selector);
    return await this.page
      .locator(selector)
      .evaluate((el, prop) => window.getComputedStyle(el).getPropertyValue(prop), property);
  }

  // ── Dimensions ──────────────────────────────────────────────────────────────

  async getElementDimensions(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    });
  }

  async getElementDimensionsObject(selector: string): Promise<{ width: number; height: number }> {
    await this.waits.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    });
  }

  async getImageNaturalDimensions(selector: string): Promise<string> {
    await this.waits.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      if (el.tagName.toLowerCase() !== "img") throw new Error("Element is not an image");
      const img = el as HTMLImageElement;
      return `${img.naturalWidth}x${img.naturalHeight}`;
    });
  }
}

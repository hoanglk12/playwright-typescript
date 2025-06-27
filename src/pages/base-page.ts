import { Page } from '@playwright/test';
import { TIMEOUTS } from '../constants/timeouts';

/**
 * Base Page class for all page objects
 * Contains common functionality similar to BasePage in the Maven framework
 */
export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to a specific URL
   */
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }



  /**
   * Wait for element to be clickable
   */
  async waitForElementClickable(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'attached', timeout });
  }

  /**
   * Check if element is displayed
   */
  async isElementDisplayed(selector: string): Promise<boolean> {
    try {
      return await this.page.isVisible(selector);
    } catch {
      return false;
    }
  }

  /**
   * Click on element
   */
  async clickElement(selector: string): Promise<void> {
    await this.waitForElementClickable(selector);
    await this.page.click(selector);
  }

  /**
   * Enter text into input field
   */
  async enterText(selector: string, text: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.fill(selector, text);
  }

  /**
   * Get text from element
   */
  async getText(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.textContent(selector) || '';
  }

  /**
   * Get attribute value from element
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    await this.waitForElement(selector);
    return await this.page.getAttribute(selector, attribute);
  }

  /**
   * Select option from dropdown by value
   */
  async selectDropdownByValue(selector: string, value: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.selectOption(selector, { value });
  }

  /**
   * Select option from dropdown by text
   */
  async selectDropdownByText(selector: string, text: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.selectOption(selector, { label: text });
  }

  /**
   * Check if checkbox/radio button is checked
   */
  async isChecked(selector: string): Promise<boolean> {
    await this.waitForElement(selector);
    return await this.page.isChecked(selector);
  }

  /**
   * Check checkbox/radio button
   */
  async check(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.check(selector);
  }

  /**
   * Uncheck checkbox
   */
  async uncheck(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.uncheck(selector);
  }

  /**
   * Wait for page to load with default networkidle state
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page to load with specific load state
   */
  async waitForPageLoadState(
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle',
    timeout: number = TIMEOUTS.PAGE_LOAD_SLOW
  ): Promise<void> {
    await this.page.waitForLoadState(state, { timeout });
  }

  /**
   * Wait for DOM content to be loaded
   */
  async waitForDOMContentLoaded(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for load event to be fired
   */
  async waitForLoadEvent(): Promise<void> {
    await this.page.waitForLoadState('load');
  }

  /**
   * Wait for network to be idle (no requests for 500ms)
   */
  async waitForNetworkIdle(timeout: number = 30000): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout });
    } catch (error) {
      console.warn('⚠️  Network idle timeout reached');
    }
  }

  /**
   * Wait for multiple load states in sequence
   */
  async waitForMultipleLoadStates(states: Array<'load' | 'domcontentloaded' | 'networkidle'>): Promise<void> {
    for (const state of states) {
      await this.page.waitForLoadState(state);
    }
  }

  /**
   * Wait for page to be fully loaded (all states)
   */
  async waitForFullPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('load');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for page load with custom timeout
   */
  async waitForPageLoadWithTimeout(timeout: number = 30000, state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle'): Promise<void> {
    await this.page.waitForLoadState(state, { timeout });
  }

  /**
   * Wait for page load and verify URL
   */
  async waitForPageLoadAndVerifyURL(expectedUrl: string | RegExp): Promise<void> {
    await this.page.waitForLoadState('networkidle');

    if (typeof expectedUrl === 'string') {
      await this.page.waitForURL(expectedUrl);
    } else {
      await this.page.waitForURL(expectedUrl);
    }
  }

  /**
   * Wait for specific element to be visible after page load
   */
  async waitForPageLoadWithElement(selector: string, loadState: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<void> {
    await this.page.waitForLoadState(loadState);
    await this.waitForElement(selector);
  }

  /**
   * Wait for page load and check if page is ready
   */
  async waitForPageReady(): Promise<boolean> {
    try {
      await this.page.waitForLoadState('domcontentloaded');

      // Check if document is ready
      const isReady = await this.page.evaluate(() => {
        return document.readyState === 'complete';
      });

      if (!isReady) {
        await this.page.waitForLoadState('load');
      }

      await this.page.waitForLoadState('networkidle');
      return true;
    } catch (error) {
      console.warn('Page load check failed:', error);
      return false;
    }
  }

  /**
   * Wait for JavaScript to finish executing
   */
  async waitForJavaScriptReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      return typeof window !== 'undefined' &&
        window.document &&
        window.document.readyState === 'complete';
    });
  }

  /**
   * Wait for jQuery to be ready (if using jQuery)
   */
  async waitForJQueryReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      return (window as any).jQuery && (window as any).jQuery.active === 0;
    }, { timeout: 10000 });
  }

  /**
   * Wait for Angular to be ready (if using Angular)
   */
  async waitForAngularReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const ng = (window as any).angular;
      if (!ng) return true;

      const injector = ng.element(document.body).injector();
      if (!injector) return true;

      const $http = injector.get('$http');
      return $http.pendingRequests.length === 0;
    }, { timeout: 10000 });
  }

  /**
   * Wait for React to be ready (if using React)
   */
  async waitForReactReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      return (window as any).React !== undefined;
    }, { timeout: 10000 });
  }

  /**
   * Wait for specific JavaScript variable to be defined
   */
  async waitForJavaScriptVariable(variableName: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForFunction((varName) => {
      return (window as any)[varName] !== undefined;
    }, variableName, { timeout });
  }

  /**
   * Wait for AJAX requests to complete
   */
  async waitForAjaxRequestsComplete(timeout: number = 30000, excludeUrls: string[] = []): Promise<void> {
    const startTime = Date.now();
    let pendingRequests: Set<string> = new Set();

    // Track ongoing requests
    this.page.on('request', (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      // Only track XHR and fetch requests
      if (resourceType === 'xhr' || resourceType === 'fetch') {
        // Skip excluded URLs
        if (!excludeUrls.some(excludeUrl => url.includes(excludeUrl))) {
          pendingRequests.add(url);
        }
      }
    });

    // Remove completed requests
    this.page.on('response', (response) => {
      const url = response.url();
      if (pendingRequests.has(url)) {
        pendingRequests.delete(url);
      }
    });

    // Remove failed requests
    this.page.on('requestfailed', (request) => {
      const url = request.url();
      if (pendingRequests.has(url)) {
        pendingRequests.delete(url);
      }
    });

    // Wait for all requests to complete
    while (pendingRequests.size > 0) {
      if (Date.now() - startTime > timeout) {
        console.warn(`⚠️  Timeout waiting for AJAX requests. Pending requests: ${Array.from(pendingRequests).join(', ')}`);
        break;
      }

      await this.page.waitForTimeout(100); // Small delay between checks
    }

    // Additional wait for any last-minute requests
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      // Ignore timeout errors for networkidle
    });
  }

  /**
   * Wait for specific AJAX request to complete
   * @param urlPattern - URL pattern to wait for
   * @param timeout - Maximum time to wait in milliseconds (default: 30000)
   */
  async waitForAjaxRequest(urlPattern: string | RegExp, timeout: number = 30000): Promise<void> {
    try {
      await this.page.waitForResponse(
        (response) => {
          const url = response.url();
          if (typeof urlPattern === 'string') {
            return url.includes(urlPattern);
          } else {
            return urlPattern.test(url);
          }
        },
        { timeout }
      );
    } catch (error) {
      console.warn(`⚠️  Timeout waiting for AJAX request: ${urlPattern}`);
      throw error;
    }
  }

  /**
   * Wait for multiple specific AJAX requests to complete
   * @param urlPatterns - Array of URL patterns to wait for
   * @param timeout - Maximum time to wait in milliseconds (default: 30000)
   */
  async waitForMultipleAjaxRequests(urlPatterns: (string | RegExp)[], timeout: number = 30000): Promise<void> {
    const promises = urlPatterns.map(pattern => this.waitForAjaxRequest(pattern, timeout));

    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('⚠️  One or more AJAX requests timed out');
      throw error;
    }
  }

  /**
   * Enhanced AJAX waiting with more control
   * @param options - Configuration options for waiting
   */
  async waitForAjaxRequestsCompleteAdvanced(options: {
    timeout?: number;
    excludeUrls?: string[];
    includeUrls?: string[];
    waitForSpinners?: boolean;
    spinnerSelectors?: string[];
    maxRetries?: number;
  } = {}): Promise<void> {
    const {
      timeout = 30000,
      excludeUrls = [],
      includeUrls = [],
      waitForSpinners = true,
      spinnerSelectors = ['.spinner', '.loading', '[data-loading]', '.ajax-loader'],
      maxRetries = 3
    } = options;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait for network requests
        await this.waitForAjaxRequestsComplete(timeout, excludeUrls);

        // Wait for spinners to disappear if enabled
        if (waitForSpinners) {
          await this.waitForSpinnersToDisappear(spinnerSelectors, timeout);
        }

        // If we have include URLs, wait for those specifically
        if (includeUrls.length > 0) {
          await this.waitForMultipleAjaxRequests(includeUrls, timeout);
        }

        return; // Success, exit retry loop
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        console.warn(`⚠️  AJAX wait attempt ${attempt} failed, retrying...`);
        await this.page.waitForTimeout(1000); // Wait before retry
      }
    }
  }

  /**
   * Wait for loading spinners to disappear
   * @param selectors - Array of spinner selectors
   * @param timeout - Maximum time to wait in milliseconds (default: 30000)
   */
  private async waitForSpinnersToDisappear(selectors: string[], timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let spinnersVisible = false;

      for (const selector of selectors) {
        try {
          const spinner = this.page.locator(selector);
          const count = await spinner.count();

          if (count > 0) {
            // Check if any spinner is visible
            for (let i = 0; i < count; i++) {
              const isVisible = await spinner.nth(i).isVisible();
              if (isVisible) {
                spinnersVisible = true;
                break;
              }
            }
          }
        } catch (error) {
          // Ignore errors for spinner checking
        }
      }

      if (!spinnersVisible) {
        return; // All spinners are gone
      }

      await this.page.waitForTimeout(100);
    }

    console.warn('⚠️  Timeout waiting for spinners to disappear');
  }

  /**
   * Wait for all images to load
   */
  async waitForAllImagesLoaded(): Promise<void> {
    await this.page.waitForFunction(() => {
      const images = Array.from(document.images);
      return images.every(img => img.complete && img.naturalHeight !== 0);
    }, { timeout: 30000 });
  }

  /**
   * Wait for specific CSS class to be present
   */
  // async waitForCSSClass(selector: string, className: string): Promise<void> {
  //   await this.page.waitForFunction(
  //     ({ sel, cls }) => {
  //       const element = document.querySelector(sel);
  //       return element && element.classList.contains(cls);
  //     },
  //     { selector, className },
  //     { timeout: 10000 }
  //   );
  // }

  /**
   * Wait for page load with loading indicator
   */
  async waitForPageLoadWithSpinner(spinnerSelector: string = '.loading, .spinner, [data-loading]'): Promise<void> {
    // Wait for DOM content first
    await this.page.waitForLoadState('domcontentloaded');

    try {
      // Wait for spinner to disappear
      await this.page.waitForSelector(spinnerSelector, { state: 'hidden', timeout: 30000 });
    } catch {
      // If no spinner found, continue with normal loading
      console.log('No loading spinner found, proceeding with normal page load');
    }

    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for custom loading condition
   */
  async waitForCustomCondition(
    condition: () => Promise<boolean> | boolean,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const { timeout = 30000, interval = 100 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) {
          return;
        }
      } catch (error) {
        // Continue polling
      }

      await this.sleep(interval);
    }

    throw new Error(`Custom condition not met within ${timeout}ms`);
  }

  /**
   * Comprehensive page load with multiple checks
   */
  async waitForCompletePageLoad(options: {
    waitForImages?: boolean;
    waitForFonts?: boolean;
    waitForAjax?: boolean;
    customSpinner?: string;
    timeout?: number;
  } = {}): Promise<void> {
    const {
      waitForImages = false,
      waitForFonts = false,
      waitForAjax = false,
      customSpinner,
      timeout = 30000
    } = options;

    // Set page timeout
    this.page.setDefaultTimeout(timeout);

    // Wait for basic page load states
    await this.waitForFullPageLoad();

    // Wait for custom spinner if provided
    if (customSpinner) {
      await this.waitForPageLoadWithSpinner(customSpinner);
    }

    // Wait for images if requested
    if (waitForImages) {
      await this.waitForAllImagesLoaded();
    }

    // Wait for fonts if requested
    if (waitForFonts) {
      await this.page.waitForFunction(() => document.fonts.ready, { timeout: 10000 });
    }

    // Wait for AJAX if requested
    if (waitForAjax) {
      await this.waitForAjaxRequestsComplete();
    }

    // Final network idle check
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * Upload single file to input element
   */
  async uploadFile(selector: string, filePath: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.setInputFiles(selector, filePath);
  }

  /**
   * Upload multiple files to input element
   */
  async uploadMultipleFiles(selector: string, filePaths: string[]): Promise<void> {
    await this.waitForElement(selector);
    await this.page.setInputFiles(selector, filePaths);
  }

  /**
   * Clear uploaded files from input element
   */
  async clearUploadedFiles(selector: string): Promise<void> {
    await this.waitForElement(selector);
    await this.page.setInputFiles(selector, []);
  }

  /**
   * Upload file and verify it was uploaded successfully
   */
  async uploadFileWithVerification(selector: string, filePath: string): Promise<boolean> {
    try {
      await this.waitForElement(selector);
      await this.page.setInputFiles(selector, filePath);

      // Verify file was uploaded by checking the input's files property
      const uploadedFiles = await this.page.inputValue(selector);
      return uploadedFiles.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get names of uploaded files from file input element
   */
  async getUploadedFileNames(selector: string): Promise<string[]> {
    try {
      await this.waitForElement(selector);
      return await this.page.evaluate((sel: string): string[] => {
        const element = document.querySelector(sel);
        if (element && (element as any).type === 'file' && (element as any).files) {
          const input = element as any;
          return Array.from(input.files).map((file: any) => file.name);
        }
        return [];
      }, selector);
    } catch (error) {
      console.warn(`Failed to get uploaded file names for selector: ${selector}`, error);
      return [];
    }
  }

  /**
   * Check if file input accepts specific file types
   */
  async getAcceptedFileTypes(selector: string): Promise<string | null> {
    await this.waitForElement(selector);
    return await this.getAttribute(selector, 'accept');
  }

  /**
   * Upload file using drag and drop
   */
  async uploadFileByDragDrop(dropZoneSelector: string, filePath: string): Promise<void> {
    try {
      await this.waitForElement(dropZoneSelector);

      // Create a file input element and set the file
      const fileInput = await this.page.evaluateHandle(() => {
        const input = (document as any).createElement('input') as any;
        input.type = 'file';
        input.style.display = 'none';
        (document as any).body.appendChild(input);
        return input;
      });

      await fileInput.asElement()?.setInputFiles(filePath);

      // Get files from the input
      const files = await fileInput.evaluate((input: any) => input.files);

      // Simulate drag and drop
      await this.page.dispatchEvent(dropZoneSelector, 'drop', {
        dataTransfer: { files }
      });

      // Clean up
      await fileInput.evaluate((input: any) => input.remove());
    } catch (error) {
      console.warn(`Failed to upload file by drag and drop: ${error}`);
      throw error;
    }
  }


  /**
   * Refresh the page
   */
  async refreshPage(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Generate random email
   */
  generateRandomEmail(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `test_${timestamp}_${random}@automation.com`;
  }

  /**
   * Generate random number
   */
  generateRandomNumber(min: number = 1000, max: number = 9999): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Convert RGB color values to hex format
   */
  protected rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number): string => {
      const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
  }

  /**
   * Convert CSS color string (rgb/rgba) to hex format
   */
  protected convertColorToHex(colorString: string): string {
    // Handle rgb format: rgb(255, 255, 255)
    const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return this.rgbToHex(
        parseInt(rgbMatch[1]),
        parseInt(rgbMatch[2]),
        parseInt(rgbMatch[3])
      );
    }

    // Handle rgba format: rgba(255, 255, 255, 0.5)
    const rgbaMatch = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
    if (rgbaMatch) {
      return this.rgbToHex(
        parseInt(rgbaMatch[1]),
        parseInt(rgbaMatch[2]),
        parseInt(rgbaMatch[3])
      );
    }

    // Handle transparent
    if (colorString === 'transparent' || colorString === 'rgba(0, 0, 0, 0)') {
      return 'transparent';
    }

    // Handle hex colors (return as-is)
    if (colorString.match(/^#[0-9a-f]{6}$/i)) {
      return colorString.toLowerCase();
    }

    // Handle hex colors without # prefix
    if (colorString.match(/^[0-9a-f]{6}$/i)) {
      return `#${colorString.toLowerCase()}`;
    }

    // Return original value for named colors or unknown formats
    return colorString;
  }

  /**
   * Get element's background color in hex format
   */
  async getElementBackgroundColorHex(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      const backgroundColor = window.getComputedStyle(el).backgroundColor;
      return backgroundColor;
    }).then(color => this.convertColorToHex(color));
  }

  /**
   * Get elements's background color in hex format
   */
  async getAllElementsBackgroundColorHex(selector: string): Promise<string[]> {
    const elements = await this.page.locator(selector).all();

    const colors: string[] = [];

    for (const element of elements) {
      const color = await element.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });
      colors.push(this.convertColorToHex(color));
    }

    return colors;
  }

  /**
   * Get element's text color in hex format
   */
  async getElementTextColorHex(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      const textColor = window.getComputedStyle(el).color;
      return textColor;
    }).then(color => this.convertColorToHex(color));
  }

  /**
   * Get element's border color in hex format
   */
  async getElementBorderColorHex(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate((el) => {
      const borderColor = window.getComputedStyle(el).borderColor;
      return borderColor;
    }).then(color => this.convertColorToHex(color));
  }

  /**
   * Get element dimensions as string format (widthxheight)
   */
  async getElementDimensions(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate(el => {
      const rect = el.getBoundingClientRect();
      return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    });
  }

  /**
   * Get element dimensions as object
   */
  async getElementDimensionsObject(selector: string): Promise<{ width: number, height: number }> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate(el => {
      const rect = el.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });
  }

  /**
   * Get image natural dimensions (for img elements)
   */
  async getImageNaturalDimensions(selector: string): Promise<string> {
    await this.waitForElement(selector);
    return await this.page.locator(selector).evaluate(el => {
      if (el.tagName.toLowerCase() === 'img') {
        const img = el as HTMLImageElement;
        return `${img.naturalWidth}x${img.naturalHeight}`;
      }
      throw new Error('Element is not an image');
    });
  }
  async acceptAlert(): Promise<void> {
    this.page.on('dialog', async (dialog) => {
      await dialog.accept();  // Accept the alert or confirm dialog
    });

  }

  async dismissAlert(): Promise<void> {
    this.page.on('dialog', async (dialog) => {
      await dialog.dismiss();  // Accept the alert or confirm dialog
    });

  }

}

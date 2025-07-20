import { Locator, Page } from '@playwright/test';
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
   * Check if element is undisplayed (not present or not visible)
   * Equivalent to isElementUndisplayed() in Maven framework
   * @param selector - CSS selector for the element
   * @param shortTimeout - Short timeout for the check (default: 2000ms)
   * @returns true if element is not present or not visible, false otherwise
   */
  async isElementUndisplayed(selector: string, shortTimeout: number = TIMEOUTS.TIMEOUT_SHORT): Promise<boolean> {
    try {
      // Use short timeout to avoid waiting too long
      const elements = await this.page.locator(selector).all();
      
      // If no elements found, return true (element is undisplayed)
      if (elements.length === 0) {
        return true;
      }
      
      // If elements found, check if the first element is not visible
      if (elements.length > 0) {
        const isVisible = await elements[0].isVisible({ timeout: shortTimeout });
        return !isVisible; // Return true if not visible
      }
      
      return false;
    } catch (error) {
      // If any error occurs (timeout, element not found, etc.), consider element as undisplayed
      return true;
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

  async waitForFullPageLoadWithSeperateNetworkidle(): Promise<void> {
  try {
    // Wait for critical states first
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('load');
    
    // Handle networkidle separately with shorter timeout
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (error) {
      console.warn('⚠️ Network idle timeout reached, continuing...');
      // Continue execution even if networkidle times out
    }
  } catch (error) {
    console.error('❌ Page load failed:', error);
    throw error;
  }
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

  async dragAndDropFile(filePath: string, uploadFileElement: string): Promise<void> {
    await this.waitForElementClickable(uploadFileElement);
    const fileInput = this.page.locator(uploadFileElement);
    await fileInput.setInputFiles(filePath);
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
      await dialog.dismiss();  // Dismiss the alert or dialog
    });

  }

  /**
   * Switch to window/tab by title
   * @param expectedTitle - The title of the window to switch to
   */
  async switchToWindowByTitle(expectedTitle: string): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    
    for (const page of allPages) {
      const currentTitle = await page.title();
      if (currentTitle === expectedTitle) {
        // Switch to this page
        this.page = page;
        await this.page.bringToFront();
        break;
      }
    }
  }

  /**
   * Switch to window/tab that is not the parent window
   * @param parentPage - Reference to the parent page to exclude
   */
  async switchToWindowById(parentPage: Page): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    
    for (const page of allPages) {
      if (page !== parentPage) {
        // Switch to this page
        this.page = page;
        await this.page.bringToFront();
        break;
      }
    }
  }

  /**
   * Close all windows/tabs except the parent window and switch back to parent
   * @param parentPage - Reference to the parent page to keep open
   */
  async closeAllWindowsWithoutParent(parentPage: Page): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    
    for (const page of allPages) {
      if (page !== parentPage) {
        await page.close();
      }
    }
    
    // Switch back to parent window
    this.page = parentPage;
    await this.page.bringToFront();
  }

  /**
   * Get all open windows/tabs count
   */
  async getWindowCount(): Promise<number> {
    const context = this.page.context();
    return context.pages().length;
  }

  /**
   * Get all window titles
   */
  async getAllWindowTitles(): Promise<string[]> {
    const context = this.page.context();
    const allPages = context.pages();
    const titles: string[] = [];
    
    for (const page of allPages) {
      const title = await page.title();
      titles.push(title);
    }
    
    return titles;
  }

  /**
   * Switch to window by index (0-based)
   * @param index - Index of the window to switch to
   */
  async switchToWindowByIndex(index: number): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    
    if (index >= 0 && index < allPages.length) {
      this.page = allPages[index];
      await this.page.bringToFront();
    } else {
      throw new Error(`Window index ${index} is out of range. Available windows: ${allPages.length}`);
    }
  }

  /**
   * Switch to the latest opened window/tab
   */
  async switchToLatestWindow(): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    
    if (allPages.length > 0) {
      this.page = allPages[allPages.length - 1];
      await this.page.bringToFront();
    }
  }

  /**
   * Switch to window by URL pattern
   * @param urlPattern - URL pattern to match (string or regex)
   */
  async switchToWindowByUrl(urlPattern: string | RegExp): Promise<boolean> {
    const context = this.page.context();
    const allPages = context.pages();
    
    for (const page of allPages) {
      const currentUrl = page.url();
      
      if (typeof urlPattern === 'string') {
        if (currentUrl.includes(urlPattern)) {
          this.page = page;
          await this.page.bringToFront();
          return true;
        }
      } else {
        if (urlPattern.test(currentUrl)) {
          this.page = page;
          await this.page.bringToFront();
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Close current window and switch to parent
   * @param parentPage - Reference to the parent page to switch back to
   */
  async closeCurrentWindowAndSwitchToParent(parentPage: Page): Promise<void> {
    const currentPage = this.page;
    
    // Switch to parent first
    this.page = parentPage;
    await this.page.bringToFront();
    
    // Close the previous page
    await currentPage.close();
  }

  /**
   * Wait for new window to open and switch to it
   * @param timeout - Maximum time to wait for new window (default: 10000ms)
   */
  async waitForNewWindowAndSwitch(timeout: number = 10000): Promise<void> {
    const context = this.page.context();
    const initialPageCount = context.pages().length;
    
    // Wait for new page to be created
    const newPage = await context.waitForEvent('page', { timeout });
    
    // Switch to the new page
    this.page = newPage;
    await this.page.bringToFront();
    
    // Wait for the new page to load
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Open new tab with URL
   * @param url - URL to open in new tab
   */
  async openNewTab(url?: string): Promise<void> {
    const context = this.page.context();
    const newPage = await context.newPage();
    
    if (url) {
      await newPage.goto(url);
    }
    
    // Switch to the new tab
    this.page = newPage;
    await this.page.bringToFront();
  }

  /**
   * Close all tabs except current
   */
  async closeAllTabsExceptCurrent(): Promise<void> {
    const context = this.page.context();
    const allPages = context.pages();
    const currentPage = this.page;
    
    for (const page of allPages) {
      if (page !== currentPage) {
        await page.close();
      }
    }
  }

  /**
   * Switch to iframe by locator
   * @param locator - CSS selector or other locator for the iframe
   * @returns FrameLocator for the iframe
   */
  async switchToFrame(locator: string): Promise<void> {
    // Wait for iframe to be available
    await this.waitForElement(locator);
    
    // Get the frame element
    const frameElement = await this.page.locator(locator).elementHandle();
    
    if (frameElement) {
      // Get the frame from the element
      const frame = await frameElement.contentFrame();
      
      if (frame) {
        // Store reference to the frame for future operations
        (this as any).currentFrame = frame;
        console.log(`✅ Switched to frame with locator: ${locator}`);
      } else {
        throw new Error(`Failed to get frame content for locator: ${locator}`);
      }
    } else {
      throw new Error(`Frame element not found for locator: ${locator}`);
    }
  }

  /**
   * Switch to iframe by index (0-based)
   * @param index - Index of the iframe to switch to
   */
  async switchToFrameByIndex(index: number): Promise<void> {
    const frames = await this.page.frames();
    
    if (index >= 0 && index < frames.length) {
      (this as any).currentFrame = frames[index];
      console.log(`✅ Switched to frame at index: ${index}`);
    } else {
      throw new Error(`Frame index ${index} is out of range. Available frames: ${frames.length}`);
    }
  }

  /**
   * Switch to iframe by name attribute
   * @param name - Name attribute of the iframe
   */
  async switchToFrameByName(name: string): Promise<void> {
    const frameLocator = `iframe[name="${name}"]`;
    await this.switchToFrame(frameLocator);
  }

  /**
   * Switch to iframe by id attribute
   * @param id - ID attribute of the iframe
   */
  async switchToFrameById(id: string): Promise<void> {
    const frameLocator = `iframe#${id}`;
    await this.switchToFrame(frameLocator);
  }

  /**
   * Switch back to default content (main page)
   */
  async switchToDefaultContent(): Promise<void> {
    // Clear the current frame reference
    (this as any).currentFrame = null;
    console.log('✅ Switched back to default content (main page)');
  }

  /**
   * Get current frame reference
   * @returns Current frame or null if on main page
   */
  getCurrentFrame(): any {
    return (this as any).currentFrame || null;
  }

  /**
   * Check if currently in a frame
   * @returns True if currently in a frame, false if on main page
   */
  isInFrame(): boolean {
    return (this as any).currentFrame !== null;
  }

  /**
   * Get all available frames
   * @returns Array of frame names/IDs
   */
  async getAllFrames(): Promise<string[]> {
    const frames = await this.page.frames();
    return frames.map((frame, index) => frame.name() || `frame-${index}`);
  }

  /**
   * Wait for iframe to be available and switch to it
   * @param locator - CSS selector for the iframe
   * @param timeout - Maximum time to wait in milliseconds
   */
  async waitForFrameAndSwitch(locator: string, timeout: number = 10000): Promise<void> {
    await this.waitForElement(locator, timeout);
    await this.switchToFrame(locator);
  }

  /**
   * Perform action in frame and switch back to default content
   * @param frameLocator - CSS selector for the iframe
   * @param action - Function to execute within the frame
   */
  async performActionInFrame<T>(
    frameLocator: string, 
    action: (frame: any) => Promise<T>
  ): Promise<T> {
    // Switch to frame
    await this.switchToFrame(frameLocator);
    
    try {
      // Execute action in frame
      const result = await action((this as any).currentFrame);
      return result;
    } finally {
      // Always switch back to default content
      await this.switchToDefaultContent();
    }
  }

  /**
   * Click element inside iframe
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   */
  async clickElementInFrame(frameLocator: string, elementLocator: string): Promise<void> {
    await this.performActionInFrame(frameLocator, async (frame) => {
      await frame.click(elementLocator);
    });
  }

  /**
   * Enter text in element inside iframe
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @param text - Text to enter
   */
  async enterTextInFrame(frameLocator: string, elementLocator: string, text: string): Promise<void> {
    await this.performActionInFrame(frameLocator, async (frame) => {
      await frame.fill(elementLocator, text);
    });
  }

  /**
   * Get text from element inside iframe
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @returns Text content of the element
   */
  async getTextFromFrame(frameLocator: string, elementLocator: string): Promise<string> {
    return await this.performActionInFrame(frameLocator, async (frame) => {
      return await frame.textContent(elementLocator) || '';
    });
  }

  /**
   * Check if element exists inside iframe
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @returns True if element exists, false otherwise
   */
  async isElementInFrameDisplayed(frameLocator: string, elementLocator: string): Promise<boolean> {
    return await this.performActionInFrame(frameLocator, async (frame) => {
      try {
        return await frame.isVisible(elementLocator);
      } catch {
        return false;
      }
    });
  }

  /**
   * Wait for element inside iframe
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @param timeout - Maximum time to wait in milliseconds
   */
  async waitForElementInFrame(
    frameLocator: string, 
    elementLocator: string, 
    timeout: number = 10000
  ): Promise<void> {
    await this.performActionInFrame(frameLocator, async (frame) => {
      await frame.waitForSelector(elementLocator, { state: 'visible', timeout });
    });
  }

  /**
   * Modern Playwright approach: Use frame locator (recommended)
   * @param frameLocator - CSS selector for the iframe
   * @returns FrameLocator for chaining operations
   */
  getFrameLocator(frameLocator: string) {
    return this.page.frameLocator(frameLocator);
  }

  /**
   * Modern approach: Click element using frame locator
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   */
  async clickInFrameModern(frameLocator: string, elementLocator: string): Promise<void> {
    await this.page.frameLocator(frameLocator).locator(elementLocator).click();
  }

  /**
   * Modern approach: Enter text using frame locator
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @param text - Text to enter
   */
  async fillInFrameModern(frameLocator: string, elementLocator: string, text: string): Promise<void> {
    await this.page.frameLocator(frameLocator).locator(elementLocator).fill(text);
  }

  /**
   * Modern approach: Get text using frame locator
   * @param frameLocator - CSS selector for the iframe
   * @param elementLocator - CSS selector for the element inside iframe
   * @returns Text content of the element
   */
  async getTextInFrameModern(frameLocator: string, elementLocator: string): Promise<string> {
    return await this.page.frameLocator(frameLocator).locator(elementLocator).textContent() || '';
  }

  /**
   * Select item in custom dropdown (based on Java implementation)
   * @param parentLocator - Selector for the dropdown trigger element
   * @param childLocator - Selector for all dropdown option elements
   * @param expectedItem - Expected text of the item to select
   */
  async selectItemInCustomDropdown(
    parentLocator: string, 
    childLocator: string, 
    expectedItem: string
  ): Promise<void> {
    // Click to open dropdown
    await this.clickElement(parentLocator);
    
    // Wait 2 seconds (equivalent to sleepInSecond(2))
    await this.sleep(2000);
    
    // Wait for all dropdown items to be present and get all elements
    await this.page.waitForSelector(childLocator, { state: 'attached' });
    const allItems = await this.page.locator(childLocator).all();
    
    // Loop through all items to find the matching one
    for (const item of allItems) {
      const itemText = await item.textContent();
      
      if (itemText && itemText.trim() === expectedItem) {
        // Scroll item into view (equivalent to jsExecutor.executeScript)
        await item.scrollIntoViewIfNeeded();
        
        // Wait 1 second (equivalent to sleepInSecond(1))
        await this.sleep(1000);
        
        // Click the item
        await item.click();
        
        // Wait 1 second (equivalent to sleepInSecond(1))
        await this.sleep(1000);
        
        // Break out of loop
        break;
      }
    }
  }
   /**
   * Hover over element and get tooltip text with multiple fallback strategies
   * @param locator - CSS selector for the element to hover over
   * @param options - Configuration options for tooltip detection
   * @returns Tooltip text using the first successful strategy
   */
  async hoverAndGetTooltipAdvanced(
    selector: string,
    options: {
      tooltipSelector?: string;
      titleAttribute?: boolean;
      dataAttributes?: string[];
      ariaLabel?: boolean;
      timeout?: number;
      waitAfterHover?: number;
    } = {}
  ): Promise<string> {
    const {
      tooltipSelector,
      titleAttribute = true,
      dataAttributes = ['data-tooltip', 'data-title', 'data-original-title'],
      ariaLabel = true,
      timeout = 5000,
      waitAfterHover = 500
    } = options;

    await this.waitForElement(selector);
    await this.page.hover(selector);
    
    // Wait a bit for tooltip to appear
    await this.sleep(waitAfterHover);

    // Strategy 1: Try custom tooltip selector first
    if (tooltipSelector) {
      try {
        await this.waitForElement(tooltipSelector, timeout);
        const tooltipText = await this.getText(tooltipSelector);
        if (tooltipText.trim()) {
          return tooltipText.trim();
        }
      } catch {
        // Continue to next strategy
      }
    }

    // Strategy 2: Try title attribute
    if (titleAttribute) {
      const titleText = await this.getAttribute(selector, 'title');
      if (titleText && titleText.trim()) {
        return titleText.trim();
      }
    }

    // Strategy 3: Try data attributes
    for (const dataAttr of dataAttributes) {
      const dataText = await this.getAttribute(selector, dataAttr);
      if (dataText && dataText.trim()) {
        return dataText.trim();
      }
    }

    // Strategy 4: Try aria-label
    if (ariaLabel) {
      const ariaText = await this.getAttribute(selector, 'aria-label');
      if (ariaText && ariaText.trim()) {
        return ariaText.trim();
      }
    }

    // Strategy 5: Try common tooltip selectors
    const commonTooltipSelectors = [
      '.tooltip', '.tooltip-inner', '.tooltip-content',
      '.popover', '.popover-content', '.popover-body',
      '[role="tooltip"]', '.ui-tooltip', '.tippy-content'
    ];

    for (const commonSelector of commonTooltipSelectors) {
      try {
        if (await this.isElementDisplayed(commonSelector)) {
          const tooltipText = await this.getText(commonSelector);
          if (tooltipText.trim()) {
            return tooltipText.trim();
          }
        }
      } catch {
        // Continue to next selector
      }
    }

    return ''; // No tooltip found
  }

}

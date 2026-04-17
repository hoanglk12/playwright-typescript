import { Page } from "@playwright/test";

/** Network interception, API mocking, monitoring, and performance metrics. */
export class NetworkHelper {
  constructor(private readonly page: Page) {}

  async monitorNetworkRequests(urlPattern?: string | RegExp): Promise<string[]> {
    const requests: string[] = [];
    this.page.on("request", (request) => {
      const url = request.url();
      if (!urlPattern) {
        requests.push(url);
      } else if (typeof urlPattern === "string" && url.includes(urlPattern)) {
        requests.push(url);
      } else if (urlPattern instanceof RegExp && urlPattern.test(url)) {
        requests.push(url);
      }
    });
    return requests;
  }

  async blockResources(resourceTypes: string[]): Promise<void> {
    await this.page.route("**/*", (route) => {
      if (resourceTypes.includes(route.request().resourceType())) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }

  async mockApiResponse(urlPattern: string | RegExp, responseData: unknown): Promise<void> {
    await this.page.route(urlPattern, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseData),
      });
    });
  }

  async interceptRequest(
    urlPattern: string | RegExp,
    modifier: (request: ReturnType<typeof this.page.route> extends Promise<infer R> ? R : never) => void
  ): Promise<void> {
    await this.page.route(urlPattern, (route) => {
      modifier(route as never);
      route.continue();
    });
  }

  async getPerformanceMetrics(): Promise<{
    loadTime: number;
    domReady: number;
    firstPaint: number;
  }> {
    return await this.page.evaluate(() => {
      const [nav] = performance.getEntriesByType(
        "navigation"
      ) as PerformanceNavigationTiming[];
      return {
        loadTime: nav ? nav.loadEventEnd - nav.startTime : 0,
        domReady: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
        firstPaint: performance.getEntriesByType("paint")[0]?.startTime ?? 0,
      };
    });
  }

  async takeElementScreenshot(selector: string, path: string): Promise<void> {
    await this.page.locator(selector).screenshot({ path });
  }

  async takeFullPageScreenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }
}

import { test as base, expect } from '@playwright/test';
import { SoftAssertHelper } from '../utils/soft-assert-helper';
import { TestLogger } from '../utils/test-logger';
import { HomePage } from '../pages/frontsite/home-page';
import { LoginPage } from '../pages/admin/login-page';
import { FormDragAndDropPage } from '@pages/frontsite/form-drag-and-drop';
import { ProfileListingPage } from '@pages/frontsite/profile-listing-page';
import { InsightsPage } from '@pages/frontsite/insights-page';
import { ServicesAZPage } from '@pages/frontsite/services-az-page';
import { EcommerceHomePage } from '@pages/ecommerce/home-page';
import { EcommerceNavPage } from '@pages/ecommerce/nav-page';
import { EcommerceSearchPage } from '@pages/ecommerce/search-page';
import { EcommercePLPPage } from '@pages/ecommerce/plp-page';
import { EcommercePDPPage } from '@pages/ecommerce/pdp-page';
import { EcommerceCartOverlayPage } from '@pages/ecommerce/cart-overlay-page';
import { EcommerceAccountModalPage } from '@pages/ecommerce/account-modal';
import { EcommerceErrorPage } from '@pages/ecommerce/error-page';
import { EcommerceCheckoutPage } from '@pages/ecommerce/checkout-page';
import { EcommerceTrackOrderPage } from '@pages/ecommerce/track-order-page';
import { EcommerceHelpSupportPage } from '@pages/ecommerce/help-support-page';
import { EcommerceWishlistPage } from '@pages/ecommerce/wishlist-page';
import { PercyHelper } from '../pages/helpers';
import { ConsoleHelper } from '@pages/helpers/console-helper';
import AxeBuilder from '@axe-core/playwright';

type CustomFixtures = {
  homePage: HomePage;
  loginPage: LoginPage;
  formDragAndDropPage: FormDragAndDropPage;
  profileListingPage: ProfileListingPage;
  insightsPage: InsightsPage;
  servicesAZPage: ServicesAZPage;
  ecommerceHomePage: EcommerceHomePage;
  ecommerceNavPage: EcommerceNavPage;
  ecommerceSearchPage: EcommerceSearchPage;
  ecommercePLPPage: EcommercePLPPage;
  ecommercePDPPage: EcommercePDPPage;
  ecommerceCartOverlayPage: EcommerceCartOverlayPage;
  ecommerceAccountModalPage: EcommerceAccountModalPage;
  ecommerceErrorPage: EcommerceErrorPage;
  ecommerceCheckoutPage: EcommerceCheckoutPage;
  ecommerceTrackOrderPage: EcommerceTrackOrderPage;
  ecommerceHelpSupportPage: EcommerceHelpSupportPage;
  ecommerceWishlistPage: EcommerceWishlistPage;
  percyHelper: PercyHelper;
  softAssert: SoftAssertHelper;
  consoleHelper: ConsoleHelper;
  makeAxeBuilder: () => AxeBuilder;
  attachTestLogs: void;
};

export const test = base.extend<CustomFixtures>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  formDragAndDropPage: async ({ page }, use) => {
    await use(new FormDragAndDropPage(page));
  },

  profileListingPage: async ({ page }, use) => {
    await use(new ProfileListingPage(page));
  },

  insightsPage: async ({ page }, use) => {
    await use(new InsightsPage(page));
  },

  servicesAZPage: async ({ page }, use) => {
    await use(new ServicesAZPage(page));
  },

  percyHelper: async ({ page }, use) => {
    await use(new PercyHelper(page));
  },

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }));
  },

  ecommerceHomePage: async ({ page }, use) => {
    await use(new EcommerceHomePage(page));
    // Firefox only: navigate to about:blank before fixture teardown so the
    // browser context closes cleanly. Firefox's Juggler protocol hangs on
    // context.close() when staging SPAs have active service workers and
    // persistent analytics/WebSocket connections. about:blank triggers the
    // unload lifecycle (deregisters service workers, closes connections).
    // Chromium handles context teardown cleanly without this workaround.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceNavPage: async ({ page }, use) => {
    await use(new EcommerceNavPage(page));
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceSearchPage: async ({ page }, use) => {
    await use(new EcommerceSearchPage(page));
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  softAssert: async ({}, use) => {
    const logger = new TestLogger(base.info().title);
    // Registers at fixture-setup time (before the spec body's own createTestLogger call),
    // so soft-assert lines land in the attachment ahead of step lines rather than
    // chronologically interleaved — content is preserved, ordering is approximate.
    logger.registerForCurrentTest();
    await use(new SoftAssertHelper(logger));
  },

  consoleHelper: async ({ page }, use, testInfo) => {
    const helper = new ConsoleHelper(page);
    await use(helper);
    await helper.summarize(testInfo.title);
  },

  // Auto fixture, no deps on `page` — flushes independently of the Firefox
  // about:blank teardown sequencing in the ecommerce page-object fixtures below.
  attachTestLogs: [async ({}, use, testInfo) => {
    await use();
    const buffer = TestLogger.consumeBuffer(testInfo.testId);
    if (buffer) {
      await testInfo.attach('test-steps.log', { body: buffer, contentType: 'text/plain' });
    }
  }, { auto: true }],

  ecommercePLPPage: async ({ page }, use) => {
    await use(new EcommercePLPPage(page));
    // Firefox teardown workaround — same pattern as other ecommerce fixtures.
    // Prevents Juggler protocol hangs caused by SPA service workers and
    // persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommercePDPPage: async ({ page }, use) => {
    await use(new EcommercePDPPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceCartOverlayPage: async ({ page }, use) => {
    await use(new EcommerceCartOverlayPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceAccountModalPage: async ({ page }, use) => {
    await use(new EcommerceAccountModalPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceErrorPage: async ({ page }, use) => {
    await use(new EcommerceErrorPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceCheckoutPage: async ({ page }, use) => {
    await use(new EcommerceCheckoutPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceTrackOrderPage: async ({ page }, use) => {
    await use(new EcommerceTrackOrderPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceHelpSupportPage: async ({ page }, use) => {
    await use(new EcommerceHelpSupportPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },

  ecommerceWishlistPage: async ({ page }, use) => {
    await use(new EcommerceWishlistPage(page));
    // Firefox teardown workaround — prevents Juggler protocol hangs on SPA service workers
    // and persistent WebSocket/analytics connections on staging storefronts.
    if (page.context().browser()?.browserType().name() === 'firefox') {
      await page.goto('about:blank', { waitUntil: 'commit', timeout: 5000 }).catch(() => {});
    }
  },
});

export { expect };
export const softExpect: typeof expect.soft = expect.soft.bind(expect);
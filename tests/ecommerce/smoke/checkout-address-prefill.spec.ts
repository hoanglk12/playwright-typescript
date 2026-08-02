import { test, expect } from '@config/base-test';
import { storefronts } from '@data/ecommerce/storefronts';
import {
  createNewSavedAddressData,
  type FreshAccountCredentials,
  type NewSavedAddressData,
} from '@data/ecommerce/test-accounts';
import {
  createFreshAccountViaGraphQL,
  confirmDefaultShippingAddressViaGraphQL,
  ensureCartOverlayOpen,
  type DefaultShippingAddressCheckResult,
} from './smoke-helpers';
import { createTestLogger } from '@utils/test-logger';
import { TIMEOUTS } from '../../../src/constants/timeouts';

// Platypus AU/NZ excluded: createCustomer GraphQL mutation returns "Internal server error"
// for these two brands specifically (confirmed via curl + existing GRA API test suite,
// 6/8 brand projects pass). See E2E-CHKOUT-009 recon notes.
const targetStorefronts = storefronts.filter((s) => !s.name.startsWith('Platypus'));

// Maximum number of search-result products scanned for one with a purchasable size, and the
// maximum number of that product's sizes tried before giving up — bounds both loops so a
// storefront with widespread stock issues fails fast rather than scanning unboundedly.
const MAX_PRODUCTS_TO_SCAN = 10;
// RECON FINDING (Dr. Martens AU staging, confirmed live): getAvailableSizes() can return
// duplicate entries clustered at the low end of the range (e.g. ["3","3","3.5",...]) that are
// all sold-out despite appearing "available" in the DOM (the same show-as-enabled-but-sold-out
// behaviour documented in checkout-helpers.ts). A bound of 3 unique sizes was too tight against
// that clustering; 8 unique sizes gives a realistic chance of reaching an in-stock adult size
// while remaining a small, explicit cap rather than an unbounded scan.
const MAX_SIZES_TO_TRY = 8;

test.describe('Ecommerce Checkout Address Prefill @ecommerce @smoke @checkout', () => {
  // Fresh account creation + login + address save + full ATC-to-checkout round trip is a long
  // multi-network-call flow, same rationale as auth.spec.ts's test.slow().
  test.slow();

  for (const [index, site] of targetStorefronts.entries()) {
    const tcId = `E2E-CHKOUT-009-${String(index + 1).padStart(3, '0')}`;
    const isNz = site.storeHeader === 'nz';
    const addressData: NewSavedAddressData = createNewSavedAddressData(isNz);

    test(`${tcId} - ${site.name} Logged-in checkout pre-fills saved default shipping address`, async ({
      request,
      ecommerceAccountModalPage,
      ecommerceMyDetailsPage,
      ecommerceSearchPage,
      ecommercePLPPage,
      ecommercePDPPage,
      ecommerceCartOverlayPage,
      ecommerceCheckoutPage,
      softAssert,
    }, testInfo) => {
      const logger = createTestLogger(`${tcId} - ${site.name} Checkout address prefill`);

      let creds!: FreshAccountCredentials;
      let created = false;
      let skipReason: string | undefined;
      await logger.step('Steps 1-2 - Create fresh account via GraphQL API', async () => {
        const result = await createFreshAccountViaGraphQL(request, site);
        creds = result.creds;
        created = result.created;
        skipReason = result.skipReason;
      });
      if (!created) {
        test.skip(true, `Account creation failed for ${site.name}: ${skipReason}`);
        return;
      }

      await logger.step('Step 3 - Log in with the fresh account', async () => {
        await ecommerceAccountModalPage.navigate(site.url);
        await ecommerceAccountModalPage.openModal();
        await ecommerceAccountModalPage.waitForModalVisible();
        await ecommerceAccountModalPage.login(creds.email, creds.password);
        await ecommerceAccountModalPage.waitForLoginComplete();
      });

      await logger.step('Step 4 - Assert login succeeded (precondition)', async () => {
        const loggedIn = await ecommerceAccountModalPage.isLoggedIn();
        logger.verify('Logged in before proceeding to /my-details', true, loggedIn);
        expect(loggedIn, `${site.name}: login must succeed before the address flow is meaningful`).toBe(true);
      });

      await logger.step('Step 5 - Navigate to /my-details and open the Add New Address drawer', async () => {
        await ecommerceMyDetailsPage.navigateToMyDetails(site.url);
        await ecommerceMyDetailsPage.openAddNewAddressDrawer();
      });

      await logger.step('Step 6 - Assert the Add New Address drawer is visible (precondition)', async () => {
        const drawerVisible = await ecommerceMyDetailsPage.isAddAddressDrawerVisible();
        logger.verify('Add New Address drawer visible', true, drawerVisible);
        expect(
          drawerVisible,
          `${site.name}: the Add New Address drawer must open before it can be filled`,
        ).toBe(true);
      });

      await logger.step('Step 7 - Switch to manual entry and fill the discrete address fields', async () => {
        await ecommerceMyDetailsPage.clickEnterAddressManually();
        await ecommerceMyDetailsPage.fillAddressDetails(addressData);
      });

      let regionComboboxVisible = false;
      let regionOptions: string[] = [];
      await logger.step('Step 8 - Open the Region/State combobox and read its options', async () => {
        regionComboboxVisible = await ecommerceMyDetailsPage.isRegionComboboxVisible();
        if (!regionComboboxVisible) return;
        await ecommerceMyDetailsPage.openRegionDropdown();
        regionOptions = await ecommerceMyDetailsPage.getRegionOptionTexts();
      });
      if (!regionComboboxVisible) {
        test.skip(
          true,
          `${site.name}: Region/State combobox not found — its selector was only confirmed live on Dr. Martens AU`,
        );
        return;
      }

      const hasExpectedRegion = regionOptions.some(
        (opt) => opt.toUpperCase() === addressData.region.toUpperCase(),
      );
      if (!hasExpectedRegion) {
        test.skip(
          true,
          `${site.name}: Region combobox options did not include "${addressData.region}" — options were [${regionOptions.join(', ')}]`,
        );
        return;
      }

      await logger.step('Step 9 - Select the region and tick "Make this my default address"', async () => {
        const regionSelected = await ecommerceMyDetailsPage.selectRegionOption(addressData.region);
        logger.verify('Region option selected', true, regionSelected);
        expect(
          regionSelected,
          `${site.name}: expected region option "${addressData.region}" must be selectable`,
        ).toBe(true);

        await ecommerceMyDetailsPage.setAsDefaultAddress();
      });

      await logger.step('Step 10 - Submit the new address', async () => {
        await ecommerceMyDetailsPage.submitNewAddress();
      });

      let defaultShippingResult: DefaultShippingAddressCheckResult = {
        hasDefaultShippingAddress: false,
        matchedAddress: null,
      };
      // Polls rather than a single-shot read: submitNewAddress() only waits for the drawer to
      // close, a client-side signal that doesn't itself prove the createCustomerAddress mutation
      // has committed server-side. expect.poll() absorbs that replication lag instead of racing
      // it with one immediate GraphQL read.
      await logger.step(
        'Step 11 - Confirm the address was saved as default_shipping via GraphQL (precondition for checkout check)',
        async () => {
          await expect
            .poll(
              async () => {
                defaultShippingResult = await confirmDefaultShippingAddressViaGraphQL(
                  request,
                  site,
                  creds,
                  addressData.firstName,
                  addressData.lastName,
                );
                return defaultShippingResult.hasDefaultShippingAddress;
              },
              {
                timeout: TIMEOUTS.NETWORK_IDLE_SLOW,
                message: `${site.name}: the new address must be confirmed default_shipping before checking checkout prefill`,
              },
            )
            .toBe(true);
        },
      );

      // Reached via site.searchTerm (not a nav-link PLP) — the nav-based PLP route used by the
      // guest checkout specs' addToCartAndReachCheckoutCta() helper currently has no purchasable
      // size on Dr. Martens AU (confirmed independently via the pre-existing
      // E2E-PLAORD-001 guest spec skipping with the identical reason), so it is not a viable
      // route for this test right now on any storefront that shares that WOMEN/MEN-nav PLP.
      await logger.step(`Step 12 - Search for "${site.searchTerm}" and open the results grid`, async () => {
        await ecommerceSearchPage.navigateToHome(site.url);
        await ecommerceSearchPage.search(site.searchTerm, site.searchResultUrlPattern);
        await ecommerceSearchPage.waitForSearchResults();
      });

      let initialCartCount = 0;
      // Select a size and Add to Cart immediately within the same product visit — some
      // storefronts silently lose the enabled Add to Cart button within ~400ms of size
      // selection (see the shared checkout-helpers.ts recon note for the same pattern). If every
      // size on a product turns out sold-out, move on to the next product instead of giving up —
      // an earlier version stopped at the first product exposing ANY listed size and never
      // reconsidered the rest of the search results, which under-counted purchasable coverage.
      let targetSize: string | null = null;
      await logger.step(
        'Step 13 - Scan search results for a product with a purchasable size and add it to cart',
        async () => {
          // Bound the loop by the ACTUAL result count — indexing past it (clickProductCard on a
          // card that never attaches) throws a hard timeout instead of a graceful "none found".
          const productCount = await ecommercePLPPage.getProductCount();
          const scanLimit = Math.min(MAX_PRODUCTS_TO_SCAN, productCount);
          for (let i = 0; i < scanLimit; i++) {
            if (i > 0) {
              // Return to the search results grid (not waitForPlpUrl() — that pattern only
              // matches nav-link category URLs, never /search). Safe to goBack() here: neither
              // selectSize() nor the isAddToCartEnabled() check below navigate the page — both
              // are in-place React state updates — so the previous history entry is still this
              // results grid, not a size/variant sub-page.
              await ecommercePDPPage.goBack();
              await ecommercePLPPage.waitForProductGrid();
            }
            await ecommercePLPPage.clickProductCard(i);
            await ecommercePDPPage.waitForPdpLoad();
            await ecommercePDPPage.ensureNoOverlay();
            let availableSizes = await ecommercePDPPage.getAvailableSizes();
            if (availableSizes.length === 0) {
              await ecommercePDPPage.waitForSizeButtonsToRender();
              availableSizes = await ecommercePDPPage.getAvailableSizes();
            }
            if (availableSizes.length === 0) continue;

            initialCartCount = await ecommercePDPPage.getMiniCartCount();
            // Deduplicate before slicing — see the MAX_SIZES_TO_TRY recon note above.
            const uniqueSizes = Array.from(new Set(availableSizes));
            for (const size of uniqueSizes.slice(0, MAX_SIZES_TO_TRY)) {
              await ecommercePDPPage.selectSize(size);
              if (await ecommercePDPPage.isAddToCartEnabled()) {
                targetSize = size;
                await ecommercePDPPage.addToCart();
                break;
              }
            }
            if (targetSize !== null) break;
          }
        },
      );
      if (targetSize === null) {
        test.skip(
          true,
          `${site.name}: no purchasable size found across the first ${MAX_PRODUCTS_TO_SCAN} results for "${site.searchTerm}"`,
        );
        return;
      }

      let postAddCount = 0;
      await logger.step('Step 14 - Poll for mini cart count to increment after ATC (precondition)', async () => {
        postAddCount = await ecommercePDPPage.waitForMiniCartCountIncrement(initialCartCount);
        expect(
          postAddCount,
          `${site.name}: cart count must increment by 1 after ATC before checkout check is meaningful`,
        ).toBe(initialCartCount + 1);
      });

      await logger.step('Step 15 - Open the mini cart overlay and click CHECKOUT', async () => {
        await ensureCartOverlayOpen(ecommerceCartOverlayPage);
        await ecommerceCheckoutPage.clickCheckoutCtaFromOverlay();
        await ecommerceCheckoutPage.waitForCheckoutLoad();
      });

      await logger.step('Step 16 - Assert checkout was reached (precondition)', async () => {
        // On a logged-in session, clicking CHECKOUT bypasses the guest auth modal and navigates
        // directly to /checkout — isOnCheckoutPage() covers both that URL and the guest auth-modal
        // fallback, so this remains a valid gate even on an unreconned storefront that behaves
        // like the guest path instead.
        const onCheckoutPage = await ecommerceCheckoutPage.isOnCheckoutPage();
        logger.verify('Checkout reached', true, onCheckoutPage);
        expect(
          onCheckoutPage,
          `${site.name}: checkout must be reached before the DELIVER TO block can be read`,
        ).toBe(true);
      });

      await logger.step('Step 17 - Wait for the DELIVER TO block to populate', async () => {
        await ecommerceCheckoutPage.waitForDeliverToAddressPopulated();
      });

      let deliverToText = '';
      await logger.step('Step 18 - Read the DELIVER TO address text and capture diagnostic HTML', async () => {
        const diagnostics = await ecommerceCheckoutPage.getDeliverToAddressDiagnostics();
        deliverToText = diagnostics.text;
        // Discriminator evidence for E2E-CHKOUT-009's recon-vs-build contradiction: a marker
        // string is attached instead of an empty body when the sibling never resolved, so a
        // zero-byte attachment can never be confused with "the attach step didn't run".
        await testInfo.attach('deliver-to-outerhtml.html', {
          body:
            diagnostics.outerHTML ||
            '<!-- DELIVER TO heading or its next-sibling container did not resolve -->',
          contentType: 'text/html',
        });
      });

      await logger.step('Step 19 - Soft-assert the DELIVER TO block reflects the saved address', async () => {
        const streetNumberToken = addressData.street.split(' ')[0];
        softAssert.toContain(deliverToText, addressData.firstName, `DELIVER TO contains address first name on ${site.name}`);
        softAssert.toContain(deliverToText, addressData.lastName, `DELIVER TO contains address last name on ${site.name}`);
        softAssert.toContain(deliverToText, streetNumberToken, `DELIVER TO contains street number token on ${site.name}`);
        softAssert.toContain(deliverToText, addressData.city, `DELIVER TO contains city on ${site.name}`);
        softAssert.toContain(deliverToText, addressData.postcode, `DELIVER TO contains postcode on ${site.name}`);
      });
    });
  }
});

import { Storefront } from '@data/ecommerce/storefronts';
import { EcommerceNavPage } from '@pages/ecommerce/nav-page';
import { EcommercePLPPage } from '@pages/ecommerce/plp-page';

/**
 * Returns the preferred nav label for a site.
 * When `preferMens` is true (Skechers, Vans NZ) the MENS nav is tried first
 * because the WOMENS PLP does not lead to footwear with size selectors.
 * Defaults to WOMENS → MENS → SALE fallback chain.
 */
export function getPreferredNavLabel(site: Storefront, preferMens = false): string | undefined {
  if (preferMens) {
    return site.mensNavLabel ?? site.womensNavLabel ?? site.saleNavLabel;
  }
  return site.womensNavLabel ?? site.mensNavLabel ?? site.saleNavLabel;
}

/**
 * Navigates from the storefront homepage to a PLP via `navLabel`.
 * Executes the standard 5-step navigation: navigate → waitForNavHydration →
 * clickNavLink → waitForPlpUrl → waitForProductGrid.
 */
export async function navigateToPlp(
  navPage: EcommerceNavPage,
  plpPage: EcommercePLPPage,
  site: Storefront,
  navLabel: string,
): Promise<void> {
  await navPage.navigate(site.url);
  await navPage.waitForNavHydration();
  await navPage.clickNavLink(navLabel);
  await plpPage.waitForPlpUrl();
  await plpPage.waitForProductGrid();
}

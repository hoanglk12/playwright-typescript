export interface AtcAnalyticsDataShape {
  /**
   * Data-layer event names identifying an add-to-cart action, in priority order.
   * Confirmed live (2026-07-17, Platypus AU staging): this GRA/Adobe Client Data Layer
   * (ACDL 2.0.2) build emits `event: 'cart_add'` on add-to-cart, not the GA4 literal
   * `'add_to_cart'`. All 8 storefronts share the same platform version
   * (magento_2.4.6-p15 | pwa_9.0.1 | gra_10.0.28.0), so this event name is expected to be
   * consistent across brands. `add_to_cart` is kept as a secondary match in case a future
   * storefront build reverts to GA4 naming.
   */
  ATC_EVENT_NAMES: readonly string[];
  /**
   * Substring discriminator identifying the add-to-cart GraphQL mutation in a POST body's
   * `query` field. Matching on `operationName` is a trap: the PWA issues a client-side
   * operation named `addConfigurableProductToCart` (singular "Product") whose query body
   * calls the schema field `addConfigurableProductsToCart` (plural "Products") — neither
   * equals nor contains the commonly assumed `addProductsToCart` ("Configurable" sits
   * between "add" and "Products"), and the name varies by product type/storefront build.
   * This substring matches every known field variant (`addProductsToCart`,
   * `addConfigurableProductsToCart`, `addSimpleProductsToCart`, ...) and appears in no
   * other GraphQL traffic observed on these storefronts (createCart,
   * createBraintreeClientToken, ClientConfiguration, etc). Do NOT "tighten" this back to
   * an exact operationName match.
   */
  ATC_MUTATION_BODY_MATCHER: string;
  /**
   * Third-party noise routes blocked during integration runs. Deliberately restricted to
   * these 4 patterns only — do NOT extend this list. The real Bloomreach A/B experiment
   * (api-accent.bloomreach.co/webxp) and the Attraqt search analytics beacon
   * (collect-ap2.attraqt.io) must run unmocked: INT-001 Boundary A/C rely on that real
   * traffic firing.
   */
  NOISE_ROUTE_PATTERNS: readonly string[];
}

export const AtcAnalyticsData: AtcAnalyticsDataShape = {
  ATC_EVENT_NAMES: ['cart_add', 'add_to_cart'],
  ATC_MUTATION_BODY_MATCHER: 'ProductsToCart',
  NOISE_ROUTE_PATTERNS: [
    '**/truefitcorp.com/**',
    '**/fullstory.com/**',
    '**/facebook.com/tr**',
    '**/taboola.com/**',
  ],
};

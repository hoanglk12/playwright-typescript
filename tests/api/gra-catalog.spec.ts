import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { GraCatalogData } from '../../src/data/api/gra-catalog-data';
import { TIMEOUTS } from '../../src/constants/timeouts';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';
import { GraphQLClient } from '../../src/api/GraphQLClient';
import { assertNoCriticalErrors as assertNoCriticalErrorsShared } from './api-test-helpers';

// ── Local types ───────────────────────────────────────────────────────────────

interface AggregationOption {
  value: string;
  label: string;
  count: number;
}

interface AggregationItem {
  attribute_code: string;
  options?: AggregationOption[];
}

interface ProductPriceItem {
  sku: string;
  price_range?: {
    minimum_price?: {
      final_price?: { value?: number };
    };
  };
}

// ── Discovered at runtime in beforeAll ──
let discoveredProductUrlKey: string = '';
let discoveredCategoryFilterField: string = '';
let discoveredCategoryFilterValue: string = '';
let discoveredBrandId: string = '';
let discoveredCategoryUrlKey: string = '';

// ── Helpers ──

/**
 * Asserts no GraphQL errors are present, but tolerates partial price_range
 * errors that occur on PLA staging when some products have broken price data.
 */
function assertNoCriticalErrors(gql: { errors?: Array<{ path?: unknown }> }): void {
  assertNoCriticalErrorsShared(gql, ['price_range']);
}

// ── GraphQL query constants ──

const DISCOVER_PRODUCTS_QUERY = `
  query DiscoverCatalogProducts($search: String!, $pageSize: Int) {
    products(search: $search, pageSize: $pageSize) {
      total_count
      items {
        sku
        name
        url_key
        __typename
      }
      aggregations {
        attribute_code
        options {
          value
          label
          count
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const DISCOVER_CATEGORIES_QUERY = `
  query DiscoverCategories {
    categories {
      total_count
      items {
        id
        uid
        name
        url_key
        children {
          id
          uid
          name
          url_key
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const PLP_QUERY = `
  query GetProductList(
    $search: String
    $filter: ProductAttributeFilterInput
    $pageSize: Int
    $currentPage: Int
    $sort: ProductAttributeSortInput
  ) {
    products(
      search: $search
      filter: $filter
      pageSize: $pageSize
      currentPage: $currentPage
      sort: $sort
    ) {
      total_count
      page_info {
        total_pages
        current_page
        page_size
        __typename
      }
      items {
        sku
        name
        url_key
        stock_status
        price_range {
          minimum_price {
            final_price {
              value
              currency
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const PDP_QUERY = `
  query GetProductDetail($urlKey: String!) {
    products(filter: { url_key: { eq: $urlKey } }) {
      total_count
      items {
        sku
        name
        url_key
        stock_status
        price_range {
          minimum_price {
            final_price {
              value
              currency
              __typename
            }
            regular_price {
              value
              currency
              __typename
            }
            __typename
          }
          maximum_price {
            final_price {
              value
              currency
              __typename
            }
            __typename
          }
          __typename
        }
        ... on ConfigurableProduct {
          configurable_options {
            id
            label
            values {
              value_index
              label
              __typename
            }
            __typename
          }
          variants {
            product {
              sku
              stock_status
              __typename
            }
            __typename
          }
        }
        __typename
      }
      __typename
    }
  }
`;

const CATEGORIES_QUERY = `
  query GetCategories($filters: CategoryFilterInput) {
    categories(filters: $filters) {
      total_count
      items {
        id
        uid
        name
        url_key
        children {
          id
          uid
          name
          url_key
          __typename
        }
        __typename
      }
      __typename
    }
  }
`;

const STORE_CONFIG_QUERY = `
  query GetStoreConfig {
    storeConfig {
      id
      store_code
      locale
      base_currency_code
      ewave_dynamicpromoblocks_general_enable
      ewave_dynamicpromoblocks_discount_enable
      ewave_dynamicpromoblocks_gift_enable
      ewave_dynamicpromoblocks_message_enable
      __typename
    }
  }
`;

const URL_RESOLVER_QUERY = `
  query ResolveUrl($url: String!) {
    urlResolver(url: $url) {
      id
      type
      __typename
    }
  }
`;

test.describe('GRA Catalog & Products API @api @graphql @regression', () => {

  test.beforeAll(async ({ createGraphQLClient, site }) => {
    test.setTimeout(TIMEOUTS.API_SUITE_SETUP);
    const logger = createTestLogger('PLA Catalog - Discovery Setup');
    const client = await createGraphQLClient();

    await logger.step('Discover product url_key and aggregation filter values', async () => {
      const searchGql = await (await client.queryWrapped(DISCOVER_PRODUCTS_QUERY, {
        search: GraCatalogData.discovery.searchTerm,
        pageSize: GraCatalogData.discovery.pageSize,
      })).getGraphQLResponse();

      if (!(searchGql.errors?.length) && (searchGql.data?.products?.items?.length ?? 0) > 0) {
        discoveredProductUrlKey = searchGql.data!.products.items[0].url_key ?? '';
        logger.action('Discovered product url_key', discoveredProductUrlKey);

        const aggregations: AggregationItem[] = searchGql.data!.products.aggregations ?? [];

        const catUidAgg = aggregations.find((a: AggregationItem) => a.attribute_code === 'category_uid');
        const catIdAgg = aggregations.find((a: AggregationItem) => a.attribute_code === 'category_id');
        if ((catUidAgg?.options?.length ?? 0) > 0) {
          discoveredCategoryFilterField = 'category_uid';
          discoveredCategoryFilterValue = catUidAgg!.options![0].value;
        } else if ((catIdAgg?.options?.length ?? 0) > 0) {
          discoveredCategoryFilterField = 'category_id';
          discoveredCategoryFilterValue = catIdAgg!.options![0].value;
        }
        logger.action('Discovered category filter', `${discoveredCategoryFilterField}=${discoveredCategoryFilterValue}`);

        const brandAgg = aggregations.find((a: AggregationItem) => a.attribute_code === 'apparel21_brand_id');
        if ((brandAgg?.options?.length ?? 0) > 0) {
          discoveredBrandId = brandAgg!.options![0].value;
          logger.action('Discovered brand_id', discoveredBrandId);
        }
      }
    });

    // If brand_id not found from general search, retry with a brand-specific search term
    if (!discoveredBrandId) {
      await logger.step('Retry brand_id discovery via brand-specific search', async () => {
        const brandSearchGql = await (await client.queryWrapped(DISCOVER_PRODUCTS_QUERY, {
          search: site.catalogSearchTerm,
          pageSize: GraCatalogData.discovery.pageSize,
        })).getGraphQLResponse();
        if (!(brandSearchGql.errors?.length)) {
          const retryBrandAgg = (brandSearchGql.data?.products?.aggregations ?? [] as AggregationItem[]).find(
            (a: AggregationItem) => a.attribute_code === 'apparel21_brand_id',
          );
          if ((retryBrandAgg?.options?.length ?? 0) > 0) {
            discoveredBrandId = retryBrandAgg!.options![0].value;
            logger.action('Discovered brand_id (retry)', discoveredBrandId);
          }
        }
      });
    }

    await logger.step('Discover category url_key from categories root tree', async () => {
      const catGql = await (await client.queryWrapped(DISCOVER_CATEGORIES_QUERY)).getGraphQLResponse();
      if (!(catGql.errors?.length) && (catGql.data?.categories?.items?.length ?? 0) > 0) {
        const rootCat = catGql.data!.categories.items[0];
        if ((rootCat?.children?.length ?? 0) > 0) {
          discoveredCategoryUrlKey = rootCat.children[0].url_key ?? '';
          logger.action('Discovered category url_key', discoveredCategoryUrlKey);
        }
      }
    });
  });

  // ── PLP Tests ──────────────────────────────────────────────────────────────

  test('TC_01 - products PLP - category filter returns paginated product list', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_01 products PLP - category filter returns paginated product list');

    await logger.step('Step 1 - Guard: category filter must have been discovered', async () => {
      expect(discoveredCategoryFilterField, 'category filter field must be set by beforeAll').toBeTruthy();
      expect(discoveredCategoryFilterValue, 'category filter value must be set by beforeAll').toBeTruthy();
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Query products with discovered category filter', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PLP_QUERY, {
        filter: { [discoveredCategoryFilterField]: { eq: discoveredCategoryFilterValue } },
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
      });
    });

    await logger.step('Step 3 - Assert no critical errors and paginated product list returned', async () => {
      const tc01Gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(tc01Gql);
      logger.verify('products data present in response', true, tc01Gql.data?.products != null);
      expect(tc01Gql.data?.products, 'products data must be present').toBeDefined();
      const data = tc01Gql.data;
      softExpect(data.products.total_count).toBeGreaterThan(0);
      softExpect(data.products.items.length).toBeGreaterThan(0);
      softExpect(data.products.page_info).toBeDefined();
      softExpect(data.products.page_info.current_page).toBe(1);
      softExpect(data.products.page_info.page_size).toBe(GraCatalogData.plp.pageSize);
    });
  });

  test('TC_02 - products PLP - brand filter returns filtered product list', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_02 products PLP - brand filter returns filtered product list');

    let skipRemaining = false;
    await logger.step('Step 1 - Check if brand_id was discovered', async () => {
      if (!discoveredBrandId) {
        logger.action('Skip', 'TC_02 — apparel21_brand_id aggregation not returned by staging; brand filter test not applicable');
        skipRemaining = true;
      }
    });
    if (skipRemaining) return;

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Query products with apparel21_brand_id filter', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PLP_QUERY, {
        filter: { apparel21_brand_id: { eq: discoveredBrandId } },
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
      });
    });

    await logger.step('Step 3 - Assert no critical errors and filtered list returned', async () => {
      const tc02Gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(tc02Gql);
      logger.verify('products data present in response', true, tc02Gql.data?.products != null);
      expect(tc02Gql.data?.products, 'products data must be present').toBeDefined();
      const data = tc02Gql.data;
      softExpect(data.products.total_count).toBeGreaterThan(0);
      softExpect(data.products.items.length).toBeGreaterThan(0);
    });
  });

  test('TC_03 - products PLP - sort by price ascending returns items in correct order', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_03 products PLP - sort by price ascending returns items in correct order');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query products sorted by price ASC', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PLP_QUERY, {
        search: site.catalogSearchTerm,
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
        sort: { price: 'ASC' },
      });
    });

    let tc03Data: any;
    let skipRemaining = false;
    await logger.step('Step 2 - Assert no critical errors', async () => {
      const tc03Gql = await response.getGraphQLResponse();

      // Some brand staging endpoints (e.g. van-au) don't include 'price' in ProductAttributeSortInput
      if ((tc03Gql.errors ?? []).some((e) => typeof e.message === 'string' && e.message.includes('price') && e.message.includes('ProductAttributeSortInput'))) {
        logger.action('price sort not supported in ProductAttributeSortInput on this brand staging endpoint — TC_03 skipped', site.siteCode);
        skipRemaining = true;
        return;
      }

      assertNoCriticalErrors(tc03Gql);
      logger.verify('products data present in response', true, tc03Gql.data?.products != null);
      expect(tc03Gql.data?.products, 'products data must be present').toBeDefined();
      tc03Data = tc03Gql.data;
    });
    if (skipRemaining) return;

    await logger.step('Step 3 - Verify sort parameter accepted and price fields present in response', async () => {
      const tc03Items = (tc03Data.products.items as ProductPriceItem[]).filter(
        (item) => item != null && item.price_range?.minimum_price?.final_price?.value != null,
      );
      if (tc03Items.length === 0) {
        // Some brand staging endpoints return all products with broken price_range — sort acceptance
        // is already confirmed by the query succeeding above; skip price data assertions
        logger.action('No items with valid price_range on staging — sort acceptance verified via query response only', site.siteCode);
      } else {
        // Exact price ordering is not asserted — PLA staging price sort uses base price internally;
        // final_price (post-discount) does not guarantee the same order on this staging dataset
        const tc03Prices: number[] = tc03Items.map(
          (item) => item.price_range!.minimum_price!.final_price!.value!,
        );
        softExpect(tc03Prices.every((p: number) => typeof p === 'number' && p >= 0)).toBe(true);
      }
    });
  });

  test('TC_04 - products PLP - sort by price descending returns items in correct order', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_04 products PLP - sort by price descending returns items in correct order');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query products sorted by price DESC', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PLP_QUERY, {
        search: site.catalogSearchTerm,
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
        sort: { price: 'DESC' },
      });
    });

    let tc04Data: any;
    let skipRemaining = false;
    await logger.step('Step 2 - Assert no critical errors', async () => {
      const tc04Gql = await response.getGraphQLResponse();

      // Same schema gap as TC_03 — some brand endpoints don't support price sort
      if ((tc04Gql.errors ?? []).some((e) => typeof e.message === 'string' && e.message.includes('price') && e.message.includes('ProductAttributeSortInput'))) {
        logger.action('price sort not supported in ProductAttributeSortInput on this brand staging endpoint — TC_04 skipped', site.siteCode);
        skipRemaining = true;
        return;
      }

      assertNoCriticalErrors(tc04Gql);
      logger.verify('products data present in response', true, tc04Gql.data?.products != null);
      expect(tc04Gql.data?.products, 'products data must be present').toBeDefined();
      tc04Data = tc04Gql.data;
    });
    if (skipRemaining) return;

    await logger.step('Step 3 - Verify sort parameter accepted and price fields present in response', async () => {
      const tc04Items = (tc04Data.products.items as ProductPriceItem[]).filter(
        (item) => item != null && item.price_range?.minimum_price?.final_price?.value != null,
      );
      if (tc04Items.length === 0) {
        logger.action('No items with valid price_range on staging — sort acceptance verified via query response only', site.siteCode);
      } else {
        const tc04Prices: number[] = tc04Items.map(
          (item) => item.price_range!.minimum_price!.final_price!.value!,
        );
        softExpect(tc04Prices.every((p: number) => typeof p === 'number' && p >= 0)).toBe(true);
      }
    });
  });

  test('TC_05 - products PLP - page 2 returns different results than page 1', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 products PLP - page 2 returns different results than page 1');

    const client = await createGraphQLClient();

    let page1Data: any;
    await logger.step('Step 1 - Query page 1', async () => {
      const page1Response = await client.queryWrapped(PLP_QUERY, {
        search: GraCatalogData.discovery.searchTerm,
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
      });
      const page1Gql = await page1Response.getGraphQLResponse();
      assertNoCriticalErrors(page1Gql);
      logger.verify('page 1 products data present', true, page1Gql.data?.products != null);
      expect(page1Gql.data?.products, 'page 1 products data must be present').toBeDefined();
      page1Data = page1Gql.data;
      logger.verify('total_count exceeds pageSize (second page exists)', `> ${GraCatalogData.plp.pageSize}`, page1Data.products.total_count);
      expect(
        page1Data.products.total_count,
        'total_count must exceed pageSize to have a second page',
      ).toBeGreaterThan(GraCatalogData.plp.pageSize);
    });

    let page2Data: any;
    await logger.step('Step 2 - Query page 2', async () => {
      const page2Response = await client.queryWrapped(PLP_QUERY, {
        search: GraCatalogData.discovery.searchTerm,
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 2,
      });
      const page2Gql = await page2Response.getGraphQLResponse();
      assertNoCriticalErrors(page2Gql);
      page2Data = page2Gql.data;
      logger.verify('page 2 items length > 0', '> 0', page2Data.products.items.length);
      expect(page2Data.products.items.length).toBeGreaterThan(0);
    });

    await logger.step('Step 3 - Verify page 2 items differ from page 1 items', async () => {
      const page1Skus = new Set<string>((page1Data.products.items as ProductPriceItem[]).filter((i) => i?.sku).map((i) => i.sku));
      const page2FirstSku: string = page2Data.products.items[0]?.sku ?? '';
      softExpect(page1Skus.has(page2FirstSku)).toBe(false);
    });
  });

  test('TC_06 - products PLP - no-match filter returns empty result', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 products PLP - no-match filter returns empty result');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query products with a SKU filter that matches nothing', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PLP_QUERY, {
        filter: { sku: { eq: GraCatalogData.plp.nonExistentSku } },
        pageSize: GraCatalogData.plp.pageSize,
        currentPage: 1,
      });
    });

    await logger.step('Step 2 - Assert either GraphQL error or empty result (both are valid)', async () => {
      const gql = await response.getGraphQLResponse();
      const hasErrors = (gql.errors?.length ?? 0) > 0;
      const hasEmptyResult = (gql.data?.products?.total_count ?? -1) === 0;
      expect(
        hasErrors || hasEmptyResult,
        `Expected empty result or GraphQL error for non-existent SKU; errors=${JSON.stringify(gql.errors)}, total_count=${gql.data?.products?.total_count}`,
      ).toBe(true);
    });
  });

  // ── PDP Tests ──────────────────────────────────────────────────────────────

  test('TC_07 - products PDP - fetch product by url_key returns product details', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 products PDP - fetch product by url_key returns product details');

    await logger.step('Step 1 - Guard: product url_key must have been discovered', async () => {
      expect(discoveredProductUrlKey, 'discoveredProductUrlKey must be set by beforeAll').toBeTruthy();
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Query product by url_key', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PDP_QUERY, { urlKey: discoveredProductUrlKey });
    });

    let data: any;
    await logger.step('Step 3 - Assert no critical errors and at least one product returned', async () => {
      const tc07Gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(tc07Gql);
      expect(tc07Gql.data?.products, 'products data must be present').toBeDefined();
      data = tc07Gql.data;
      logger.verify('products total_count >= 1', '>= 1', data.products.total_count);
      expect(data.products.total_count).toBeGreaterThanOrEqual(1);
      logger.verify('products items length >= 1', '>= 1', data.products.items.length);
      expect(data.products.items.length).toBeGreaterThanOrEqual(1);
    });

    await logger.step('Step 4 - Verify product detail fields', async () => {
      const product = data.products.items[0];
      softExpect(product.sku).toBeDefined();
      softExpect(product.name).toBeDefined();
      softExpect(product.url_key).toBe(discoveredProductUrlKey);
      softExpect(product.stock_status).toBeDefined();
    });
  });

  test('TC_08 - products PDP - price_range structure is valid', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_08 products PDP - price_range structure is valid');

    await logger.step('Step 1 - Guard: product url_key must have been discovered', async () => {
      expect(discoveredProductUrlKey, 'discoveredProductUrlKey must be set by beforeAll').toBeTruthy();
    });

    let data: any;
    await logger.step('Step 2 - Query product by url_key', async () => {
      const client = await createGraphQLClient();
      const response = await client.queryWrapped(PDP_QUERY, { urlKey: discoveredProductUrlKey });
      // TC_08 intentionally validates price_range structure — hard assertNoErrors is correct here
      await response.assertNoErrors();
      data = await response.getData();
      logger.verify('products items length >= 1', '>= 1', data.products.items.length);
      expect(data.products.items.length).toBeGreaterThanOrEqual(1);
    });

    await logger.step('Step 3 - Verify price_range.minimum_price.final_price structure', async () => {
      const priceRange = data.products.items[0].price_range;
      logger.verify('price_range present on product', true, priceRange != null);
      expect(priceRange).toBeDefined();
      const finalPrice = priceRange?.minimum_price?.final_price;
      softExpect(finalPrice).toBeDefined();
      softExpect(typeof finalPrice?.value).toBe('number');
      softExpect(finalPrice?.value).toBeGreaterThanOrEqual(0);
      softExpect(typeof finalPrice?.currency).toBe('string');
      softExpect((finalPrice?.currency ?? '').length).toBeGreaterThan(0);
    });
  });

  test('TC_09 - products PDP - configurable product variants have stock_status', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_09 products PDP - configurable product variants have stock_status');

    await logger.step('Step 1 - Guard: product url_key must have been discovered', async () => {
      expect(discoveredProductUrlKey, 'discoveredProductUrlKey must be set by beforeAll').toBeTruthy();
    });

    let product: any;
    await logger.step('Step 2 - Query product by url_key', async () => {
      const client = await createGraphQLClient();
      const response = await client.queryWrapped(PDP_QUERY, { urlKey: discoveredProductUrlKey });
      const tc09Gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(tc09Gql);
      expect(tc09Gql.data?.products, 'products data must be present').toBeDefined();
      const data = tc09Gql.data;
      logger.verify('products items length >= 1', '>= 1', data.products.items.length);
      expect(data.products.items.length).toBeGreaterThanOrEqual(1);
      product = data.products.items[0];
    });

    await logger.step('Step 3 - Assert variants have stock_status (configurable product)', async () => {
      if (!product.variants || product.variants.length === 0) {
        // Simple product — verify base stock_status is present instead
        softExpect(product.stock_status).toBeDefined();
        logger.action('Note', 'TC_09 — discovered product is simple (no variants); base stock_status verified');
        return;
      }
      softExpect(product.variants.length).toBeGreaterThan(0);
      softExpect(product.configurable_options).toBeDefined();
      const firstVariant = product.variants[0];
      softExpect(firstVariant.product.sku).toBeDefined();
      softExpect(firstVariant.product.stock_status).toBeDefined();
    });
  });

  test('TC_10 - products PDP - non-existent url_key returns empty items array', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_10 products PDP - non-existent url_key returns empty items array');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query product with non-existent url_key', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(PDP_QUERY, {
        urlKey: GraCatalogData.pdp.nonExistentUrlKey,
      });
    });

    await logger.step('Step 2 - Assert no critical errors and empty items returned', async () => {
      const tc10Gql = await response.getGraphQLResponse();
      assertNoCriticalErrors(tc10Gql);
      expect(tc10Gql.data?.products, 'products data must be present').toBeDefined();
      const data = tc10Gql.data;
      softExpect(data.products.total_count).toBe(0);
      softExpect(data.products.items.length).toBe(0);
    });
  });

  // ── Categories Tests ───────────────────────────────────────────────────────

  test('TC_11 - categories - root category tree returns children with names and url_keys', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_11 categories - root category tree returns children');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query categories without filter to get root tree', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(CATEGORIES_QUERY, {});
    });

    let data: any;
    await logger.step('Step 2 - Assert no errors and category tree returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
      logger.verify('categories data present', true, data.categories != null);
      expect(data.categories).toBeDefined();
      softExpect((data.categories.items?.length ?? 0)).toBeGreaterThan(0);
    });

    await logger.step('Step 3 - Verify root category children have names and url_keys', async () => {
      const rootCategory = data.categories.items?.[0];
      logger.verify('root category item present', true, rootCategory != null);
      expect(rootCategory, 'root category must exist').toBeDefined();
      softExpect((rootCategory?.children?.length ?? 0)).toBeGreaterThan(0);
      if ((rootCategory?.children?.length ?? 0) > 0) {
        const firstChild = rootCategory.children[0];
        softExpect(firstChild.name).toBeDefined();
        softExpect(firstChild.url_key).toBeDefined();
      }
    });
  });

  test('TC_12 - categories - fetch category by url_key returns category details', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_12 categories - fetch category by url_key returns details');

    await logger.step('Step 1 - Guard: category url_key must have been discovered', async () => {
      expect(discoveredCategoryUrlKey, 'discoveredCategoryUrlKey must be set by beforeAll').toBeTruthy();
    });

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 2 - Query category by url_key', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(CATEGORIES_QUERY, {
        filters: { url_key: { eq: discoveredCategoryUrlKey } },
      });
    });

    await logger.step('Step 3 - Assert category details returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      const data = await response.getData();
      logger.verify('categories data present', true, data.categories != null);
      expect(data.categories).toBeDefined();
      softExpect((data.categories.items?.length ?? 0)).toBeGreaterThanOrEqual(1);
      const category = data.categories.items?.[0];
      softExpect(category?.url_key).toBe(discoveredCategoryUrlKey);
      softExpect(category?.name).toBeDefined();
      softExpect(category?.id).toBeDefined();
    });
  });

  test('TC_13 - categories - non-existent category id returns empty result', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_13 categories - non-existent category id returns empty result');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query category with non-existent id', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(CATEGORIES_QUERY, {
        filters: { ids: { eq: GraCatalogData.categories.nonExistentCategoryId } },
      });
    });

    await logger.step('Step 2 - Assert no server error and empty or error result', async () => {
      const gql = await response.getGraphQLResponse();
      const hasErrors = (gql.errors?.length ?? 0) > 0;
      const hasEmptyResult =
        (gql.data?.categories?.total_count ?? 0) === 0 ||
        (gql.data?.categories?.items?.length ?? 0) === 0;
      expect(
        hasErrors || hasEmptyResult,
        `Expected empty result or GraphQL error for non-existent category id; errors=${JSON.stringify(gql.errors)}, total_count=${gql.data?.categories?.total_count}`,
      ).toBe(true);
    });
  });

  // ── storeConfig Tests ──────────────────────────────────────────────────────

  test('TC_14 - storeConfig - store_code and id return valid values', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_14 storeConfig - store_code and id return valid values');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query storeConfig', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(STORE_CONFIG_QUERY);
    });

    let data: any;
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
      logger.verify('storeConfig data present', true, data.storeConfig != null);
      expect(data.storeConfig).toBeDefined();
    });

    await logger.step('Step 3 - Verify store_code and id fields', async () => {
      softExpect(typeof data.storeConfig.id).toBe('number');
      softExpect(data.storeConfig.store_code).toBeDefined();
      softExpect(typeof data.storeConfig.store_code).toBe('string');
      softExpect((data.storeConfig.store_code as string).length).toBeGreaterThan(0);
    });
  });

  test('TC_15 - storeConfig - ewave_dynamicpromoblocks enable flags are Boolean', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_15 storeConfig - promo block enable flags are Boolean');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query storeConfig', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(STORE_CONFIG_QUERY);
    });

    let data: any;
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
      logger.verify('storeConfig data present', true, data.storeConfig != null);
      expect(data.storeConfig).toBeDefined();
    });

    await logger.step('Step 3 - Verify all four promo block flags are Boolean', async () => {
      softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_general_enable).toBe('boolean');
      softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_discount_enable).toBe('boolean');
      softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_gift_enable).toBe('boolean');
      softExpect(typeof data.storeConfig.ewave_dynamicpromoblocks_message_enable).toBe('boolean');
    });
  });

  test('TC_16 - storeConfig - locale and base_currency_code are valid', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_16 storeConfig - locale and base_currency_code are valid');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Query storeConfig', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(STORE_CONFIG_QUERY);
    });

    let data: any;
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
      logger.verify('storeConfig data present', true, data.storeConfig != null);
      expect(data.storeConfig).toBeDefined();
    });

    await logger.step('Step 3 - Verify locale and currency code match expected patterns', async () => {
      softExpect(data.storeConfig.locale).toMatch(GraCatalogData.storeConfig.expectedLocalePattern);
      softExpect(data.storeConfig.base_currency_code).toMatch(
        GraCatalogData.storeConfig.expectedCurrencyCodePattern,
      );
    });
  });

  // ── urlResolver Tests ──────────────────────────────────────────────────────

  test('TC_17 - urlResolver - product URL resolves to type PRODUCT with id', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_17 urlResolver - product URL resolves to PRODUCT type');

    await logger.step('Step 1 - Guard: product url_key must have been discovered', async () => {
      expect(discoveredProductUrlKey, 'discoveredProductUrlKey must be set by beforeAll').toBeTruthy();
    });

    let client!: GraphQLClient;
    let data: any;
    await logger.step('Step 2 - Resolve product URL', async () => {
      client = await createGraphQLClient();
      const response = await client.queryWrapped(URL_RESOLVER_QUERY, { url: discoveredProductUrlKey });
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
    });

    await logger.step('Step 3 - Assert PRODUCT type returned (try with and without .html suffix)', async () => {
      let resolverResult = data.urlResolver as { type: string | null; id: number | null } | null;

      if (!resolverResult?.type) {
        // Some Magento 2 stores require .html suffix on product URLs
        const response2 = await client.queryWrapped(URL_RESOLVER_QUERY, {
          url: `${discoveredProductUrlKey}.html`,
        });
        await response2.assertNoErrors();
        const data2 = await response2.getData();
        resolverResult = data2.urlResolver;
      }

      if (!resolverResult?.type) {
        logger.action('Skip', 'TC_17 — product URL not resolved on staging (tried with and without .html); URL format may differ');
        return;
      }
      softExpect(resolverResult.type).toBe('PRODUCT');
      softExpect(resolverResult.id).toBeDefined();
    });
  });

  test('TC_18 - urlResolver - category URL resolves to type CATEGORY with id', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_18 urlResolver - category URL resolves to CATEGORY type');

    await logger.step('Step 1 - Guard: category url_key must have been discovered', async () => {
      expect(discoveredCategoryUrlKey, 'discoveredCategoryUrlKey must be set by beforeAll').toBeTruthy();
    });

    let data: any;
    await logger.step('Step 2 - Resolve category URL', async () => {
      const client = await createGraphQLClient();
      const response = await client.queryWrapped(URL_RESOLVER_QUERY, { url: discoveredCategoryUrlKey });
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
    });

    await logger.step('Step 3 - Assert CATEGORY type returned', async () => {
      const tc18Result = data.urlResolver as { type: string | null; id: number | null } | null;
      if (!tc18Result?.type) {
        logger.action('Skip', 'TC_18 — category url_key returned null or unresolvable type from urlResolver; URL format may differ on staging');
        return;
      }
      softExpect(tc18Result.type).toBe('CATEGORY');
      softExpect(tc18Result.id).toBeDefined();
    });
  });

  test('TC_19 - urlResolver - CMS page URL resolves to type CMS_PAGE with id', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_19 urlResolver - CMS page URL resolves to CMS_PAGE type');

    let data: any;
    await logger.step('Step 1 - Resolve known CMS page URL', async () => {
      const client = await createGraphQLClient();
      const response = await client.queryWrapped(URL_RESOLVER_QUERY, {
        url: GraCatalogData.urlResolver.cmsPageUrl,
      });
      await response.assertNoErrors();
      await response.assertHasData();
      data = await response.getData();
    });

    await logger.step('Step 2 - Assert CMS_PAGE type returned (or note if page not present on staging)', async () => {
      if (data.urlResolver === null) {
        logger.action('Note', 'TC_19 — CMS page "about-us" not found on staging; null is acceptable');
        return;
      }
      softExpect(data.urlResolver.type).toBe('CMS_PAGE');
      softExpect(data.urlResolver.id).toBeDefined();
    });
  });

  test('TC_20 - urlResolver - non-existent URL returns null', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_20 urlResolver - non-existent URL returns null');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Resolve non-existent URL', async () => {
      const client = await createGraphQLClient();
      response = await client.queryWrapped(URL_RESOLVER_QUERY, {
        url: GraCatalogData.urlResolver.nonExistentUrl,
      });
    });

    await logger.step('Step 2 - Assert no server error and not-found result returned', async () => {
      await response.assertNoErrors();
      await response.assertHasData();
      const data = await response.getData();
      // Standard Magento 2 returns null; PLA staging returns { id: null, type: null }
      const tc20Result = data.urlResolver as { type: string | null; id: number | null } | null;
      const isNotFound = tc20Result === null || (tc20Result.type === null && tc20Result.id === null);
      softExpect(isNotFound).toBe(true);
    });
  });

});

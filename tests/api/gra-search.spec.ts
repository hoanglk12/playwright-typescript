import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { GraSearchData } from '../../src/data/api/gra-search-data';

const PRODUCT_SEARCH_QUERY = `
  query ProductSearch($search: String!, $pageSize: Int, $currentPage: Int) {
    products(search: $search, pageSize: $pageSize, currentPage: $currentPage) {
      total_count
      items {
        sku
        name
        __typename
      }
      aggregations {
        attribute_code
        label
        __typename
      }
      __typename
    }
  }
`;

const PRODUCT_SEARCH_SUGGESTIONS_QUERY = `
  query ProductSearchSuggestions($phrase: String!, $page_size: Int) {
    productSearch(phrase: $phrase, page_size: $page_size) {
      items {
        name
        url
        __typename
      }
      __typename
    }
  }
`;

test.describe('GRA Search API @api @graphql @regression', () => {

  test('TC_01 - products - valid search term returns non-empty results with aggregations', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_01 products - valid search term returns non-empty results');

    logger.step(`Step 1 - Execute ProductSearch query with valid search term "${site.catalogSearchTerm}"`);
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_QUERY, {
      search: site.catalogSearchTerm,
      pageSize: GraSearchData.pagination.pageSize,
      currentPage: 1,
    });

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    logger.step('Step 3 - Assert results non-empty');
    const data = await response.getData();
    expect(data.products).toBeDefined();
    softExpect(data.products.total_count).toBeGreaterThan(0);
    softExpect(data.products.items.length).toBeGreaterThan(0);
    softExpect(data.products.aggregations).toBeDefined();
    logger.verify('total_count > 0', true, data.products.total_count > 0);
    logger.verify('items non-empty', true, data.products.items.length > 0);
  });

  test('TC_02 - products - valid search term returns items with expected shape', async ({ createGraphQLClient, site }) => {
    const logger = createTestLogger('TC_02 products - valid search term returns items with sku and name');

    logger.step('Step 1 - Execute ProductSearch query with valid search term');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_QUERY, {
      search: site.catalogSearchTerm,
      pageSize: GraSearchData.pagination.pageSize,
      currentPage: 1,
    });

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    logger.step('Step 3 - Assert at least one item is returned');
    const data = await response.getData();
    expect(data.products.items.length).toBeGreaterThan(0);

    logger.step('Step 4 - Assert items have expected shape (sku, name fields)');
    const firstItem = data.products.items[0];
    softExpect(firstItem.sku).toBeDefined();
    softExpect(firstItem.name).toBeDefined();
    softExpect(typeof firstItem.sku).toBe('string');
    softExpect(typeof firstItem.name).toBe('string');
    logger.verify('first item has sku', true, !!firstItem.sku);
    logger.verify('first item has name', true, !!firstItem.name);
  });

  test('TC_03 - products - nonsense search term returns empty results', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_03 products - nonsense search term returns empty results');

    logger.step('Step 1 - Execute ProductSearch query with nonsense term');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_QUERY, {
      search: GraSearchData.searchTerms.noResults,
      pageSize: GraSearchData.pagination.pageSize,
      currentPage: 1,
    });

    logger.step('Step 2 - Assert no server error (query succeeds)');
    await response.assertNoErrors();
    await response.assertHasData();

    logger.step('Step 3 - Assert empty results');
    const data = await response.getData();
    softExpect(data.products.total_count).toBe(0);
    softExpect(data.products.items.length).toBe(0);
    logger.verify('total_count is 0', 0, data.products.total_count);
  });

  test('TC_04 - products - special characters in search term handled gracefully', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_04 products - special characters handled without server error');

    logger.step('Step 1 - Execute ProductSearch query with special characters');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_QUERY, {
      search: GraSearchData.searchTerms.specialChars,
      pageSize: GraSearchData.pagination.pageSize,
      currentPage: 1,
    });

    logger.step('Step 2 - Assert no server error (graceful handling)');
    await response.assertNoErrors();
    await response.assertHasData();

    logger.step('Step 3 - Assert result shape is valid');
    const data = await response.getData();
    softExpect(data.products).toBeDefined();
    softExpect(data.products.total_count).toBeDefined();
    softExpect(Array.isArray(data.products.items)).toBe(true);
    logger.verify('no server error on special chars', true, data.products !== undefined);
  });

  test('TC_05 - products - empty string search handled gracefully', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_05 products - empty string search returns data or error without crash');

    logger.step('Step 1 - Execute ProductSearch query with empty string');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_QUERY, {
      search: GraSearchData.searchTerms.emptyString,
      pageSize: GraSearchData.pagination.pageSize,
      currentPage: 1,
    });

    logger.step('Step 2 - Handle both valid response and GraphQL error gracefully');
    const gqlResponse = await response.getGraphQLResponse();
    const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
    const hasData = gqlResponse.data?.products !== undefined;

    logger.step('Step 3 - Assert no server crash (HTTP-level)');
    softExpect(hasErrors || hasData).toBe(true);
    logger.verify('API returned either errors or data (no crash)', true, hasErrors || hasData);

    if (!hasErrors) {
      softExpect(gqlResponse.data!.products).toBeDefined();
    }
  });

  test('TC_06 - productSearch - short autocomplete phrase returns suggestions or schema-not-supported error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_06 productSearch - short phrase returns suggestions or known schema error');

    logger.step('Step 1 - Execute ProductSearchSuggestions query with short phrase');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_SUGGESTIONS_QUERY, {
      phrase: GraSearchData.searchTerms.autocomplete,
      page_size: GraSearchData.pagination.pageSize,
    });

    logger.step('Step 2 - Handle: field supported (data returned) OR schema error (field not in this API version)');
    const gqlResponse = await response.getGraphQLResponse();
    const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
    const isSchemaError = hasErrors && gqlResponse.errors!.some(
      (e: { message?: string }) => e.message?.includes('Cannot query field') && e.message?.includes('productSearch')
    );

    if (isSchemaError) {
      // productSearch is listed as P2 New — not yet available on this staging endpoint
      logger.verify('productSearch not in schema (P2 — not yet deployed)', true, isSchemaError);
      logger.action('TC_06 — productSearch field not available in current schema', 'skipping data assertions');
      return;
    }

    logger.step('Step 3 - Field available: assert suggestion items are defined');
    await response.assertNoErrors();
    await response.assertHasData();
    const data = await response.getData();
    softExpect(data.productSearch).toBeDefined();
    softExpect(Array.isArray(data.productSearch.items)).toBe(true);
    logger.verify('productSearch.items is array', true, Array.isArray(data.productSearch.items));
  });

  test('TC_07 - productSearch - no-match phrase returns empty suggestions or schema-not-supported error', async ({ createGraphQLClient }) => {
    const logger = createTestLogger('TC_07 productSearch - no-match phrase returns empty suggestions or known schema error');

    logger.step('Step 1 - Execute ProductSearchSuggestions query with no-match phrase');
    const client = await createGraphQLClient();
    const response = await client.queryWrapped(PRODUCT_SEARCH_SUGGESTIONS_QUERY, {
      phrase: GraSearchData.searchTerms.autocompleteNoMatch,
      page_size: GraSearchData.pagination.pageSize,
    });

    logger.step('Step 2 - Handle: field supported (data returned) OR schema error (field not in this API version)');
    const gqlResponse = await response.getGraphQLResponse();
    const hasErrors = (gqlResponse.errors?.length ?? 0) > 0;
    const isSchemaError = hasErrors && gqlResponse.errors!.some(
      (e: { message?: string }) => e.message?.includes('Cannot query field') && e.message?.includes('productSearch')
    );

    if (isSchemaError) {
      logger.verify('productSearch not in schema (P2 — not yet deployed)', true, isSchemaError);
      logger.action('TC_07 — productSearch field not available in current schema', 'skipping data assertions');
      return;
    }

    logger.step('Step 3 - Field available: assert response shape is valid (items may be empty)');
    await response.assertNoErrors();
    await response.assertHasData();
    const data = await response.getData();
    softExpect(data.productSearch).toBeDefined();
    softExpect(Array.isArray(data.productSearch.items)).toBe(true);
    logger.verify('empty suggestions returned without error', true, Array.isArray(data.productSearch.items));
  });
});

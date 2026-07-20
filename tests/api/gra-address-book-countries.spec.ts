import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { addressBookCountriesData, CountryItem } from '../../src/data/api/gra-address-book-countries-data';
import { GraphQLResponseWrapper } from '../../src/api/GraphQLResponse';

const COUNTRIES_QUERY = `
  query GetCountries {
    countries {
      id
      full_name_locale
      __typename
    }
  }
`;

test.describe('GRA GraphQL API - Address Book: countries @api @regression', () => {

  test('TC_01 - Fetch all countries → store country present in list', async ({ graphqlClient, site }) => {
    const logger = createTestLogger('TC_01 Fetch all countries → store country present in list');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute countries query', async () => {
      response = await graphqlClient.queryWrapped(COUNTRIES_QUERY);
    });

    let countries!: CountryItem[];
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      countries = data.countries;
    });

    await logger.step('Step 3 - Assert store country is present in the list', async () => {
      expect(countries.length, 'Expected at least one country in response').toBeGreaterThan(0);

      const expectedCountryName = site.countryCode === 'AU' ? 'Australia' : 'New Zealand';
      const country = countries.find((c) => c.id === site.countryCode);
      logger.verify(`${site.countryCode} found in countries list`, site.countryCode, country?.id);
      expect(country, `${site.countryCode} must be present in countries list`).toBeDefined();
      expect(country?.full_name_locale).toBe(expectedCountryName);
    });
  });

  test('TC_02 - Verify id and full_name_locale structure for every country', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_02 Verify id and full_name_locale structure for every country');

    let response!: GraphQLResponseWrapper;
    await logger.step('Step 1 - Execute countries query', async () => {
      response = await graphqlClient.queryWrapped(COUNTRIES_QUERY);
    });

    let countries!: CountryItem[];
    await logger.step('Step 2 - Assert no errors', async () => {
      await response.assertNoErrors();
      await response.assertHasData();

      const data = await response.getData();
      countries = data.countries;
    });

    await logger.step('Step 3 - Assert every country has id and full_name_locale', async () => {
      expect(countries.length, 'Expected at least one country in response').toBeGreaterThan(0);

      for (const country of countries) {
        softExpect(typeof country.id).toBe('string');
        softExpect(country.id.length, `country.id must be non-empty (got "${country.id}")`).toBeGreaterThan(0);
        softExpect(typeof country.full_name_locale).toBe('string');
        softExpect(country.full_name_locale.length, `full_name_locale must be non-empty for country "${country.id}"`).toBeGreaterThan(0);
        softExpect(country.__typename).toBe(addressBookCountriesData.expectedAustralia.expectedTypeName);
      }

      logger.verify('Countries list size (all iterated for structure)', '>= 1', countries.length);
    });
  });

});

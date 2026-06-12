import { graTest as test, expect, softExpect } from './gra-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { addressBookCountriesData, CountryItem } from '../../src/data/api/pla-address-book-countries-data';

const COUNTRIES_QUERY = `
  query GetCountries {
    countries {
      id
      full_name_locale
      __typename
    }
  }
`;

test.describe('PLA GraphQL API - Address Book: countries @api @regression', () => {

  test('TC_01 - Fetch all countries → AU present in list', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_01 Fetch all countries → AU present in list');

    logger.step('Step 1 - Execute countries query');
    const response = await graphqlClient.queryWrapped(COUNTRIES_QUERY);

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const countries: CountryItem[] = data.countries;

    logger.step('Step 3 - Assert AU is present in the list');
    expect(countries.length, 'Expected at least one country in response').toBeGreaterThan(0);

    const au = countries.find((c) => c.id === addressBookCountriesData.expectedAustralia.id);
    logger.verify('AU found in countries list', addressBookCountriesData.expectedAustralia.id, au?.id);
    expect(au, 'AU must be present in countries list').toBeDefined();
    expect(au?.full_name_locale).toBe(addressBookCountriesData.expectedAustralia.full_name_locale);
  });

  test('TC_02 - Verify id and full_name_locale structure for every country', async ({ graphqlClient }) => {
    const logger = createTestLogger('TC_02 Verify id and full_name_locale structure for every country');

    logger.step('Step 1 - Execute countries query');
    const response = await graphqlClient.queryWrapped(COUNTRIES_QUERY);

    logger.step('Step 2 - Assert no errors');
    await response.assertNoErrors();
    await response.assertHasData();

    const data = await response.getData();
    const countries: CountryItem[] = data.countries;

    logger.step('Step 3 - Assert every country has id and full_name_locale');
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

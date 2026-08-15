import * as z from 'zod';
import { CountryItem } from '../gra-address-book-countries-data';

/**
 * Zod schema for the GRA GetCountries GraphQL response `data` field.
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 */

// __typename stays z.string() (never z.literal), categorically, per Rule 06 in
// tests/api/CLAUDE.md — countries proved non-polymorphic on all 8 brands, but the ban
// carves out no exception per query. `__typename === 'Country'` stays an ordinary
// assertion in gra-address-book-countries.spec.ts, outside the schema.
const CountrySchema: z.ZodType<CountryItem> = z.looseObject({
  id: z.string(),
  full_name_locale: z.string(),
  __typename: z.string(),
});

export interface CountriesQueryData {
  countries: CountryItem[];
}

export const CountriesQueryDataSchema: z.ZodType<CountriesQueryData> = z.looseObject({
  countries: z.array(CountrySchema),
});

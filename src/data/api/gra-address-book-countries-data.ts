export interface CountryItem {
  id: string;
  full_name_locale: string;
  __typename: string;
}

export interface CountryExpectation {
  id: string;
  full_name_locale: string;
  expectedTypeName: string;
}

export interface AddressBookCountriesDataShape {
  expectedAustralia: CountryExpectation;
}

export const addressBookCountriesData: AddressBookCountriesDataShape = {
  expectedAustralia: {
    id: 'AU',
    full_name_locale: 'Australia',
    expectedTypeName: 'Country',
  },
};

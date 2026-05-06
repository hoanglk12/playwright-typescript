

export interface SortBySurname {
  SURNAME: string;
  SURNAME_ASC: string;
  SURNAME_DESC: string;
}

export interface SortDataShape {
  SORT_BY_DEFAULT: string;
  SORT_BY_SURNAME: SortBySurname;
}

/**
 * Generate random test data
 */
export class ProfileListingTestDataGenerator {
  static profileListingUrl: string = 'https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en/people'
 
}

/**
 * Admin data for BankGuru application
 */
export const SortData: SortDataShape = {
  
  SORT_BY_DEFAULT: 'Seniority',
  SORT_BY_SURNAME: {
    SURNAME : 'Surname',
    SURNAME_ASC: 'Ascending',
    SURNAME_DESC: 'Descending'
  },
  
};

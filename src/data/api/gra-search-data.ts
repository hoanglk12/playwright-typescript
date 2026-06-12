/**
 * PLA (Platypus Shoes) GraphQL API — Search Test Data
 * Used by pla-search.spec.ts
 */

export interface SearchTermsShape {
  valid: string;
  noResults: string;
  specialChars: string;
  emptyString: string;
  autocomplete: string;
  autocompleteNoMatch: string;
}

export interface SearchPaginationShape {
  pageSize: number;
}

export interface PlaSearchDataShape {
  searchTerms: SearchTermsShape;
  pagination: SearchPaginationShape;
}

export const PlaSearchData: PlaSearchDataShape = {
  searchTerms: {
    valid: 'nike',
    noResults: 'xyzzy12345qwerty',
    specialChars: '<script>alert(1)</script>',
    emptyString: '',
    autocomplete: 'ni',
    autocompleteNoMatch: 'xyzzy_no_match',
  },
  pagination: {
    pageSize: 12,
  },
};

export interface GraCatalogDiscoveryShape {
  searchTerm: string;
  pageSize: number;
  brandRetryTerm: string;
}

export interface GraCatalogPlpShape {
  pageSize: number;
  nonExistentSku: string;
}

export interface GraCatalogPdpShape {
  nonExistentUrlKey: string;
}

export interface GraCatalogCategoriesShape {
  nonExistentCategoryId: string;
}

export interface GraCatalogStoreConfigShape {
  expectedLocalePattern: RegExp;
  expectedCurrencyCodePattern: RegExp;
}

export interface GraCatalogUrlResolverShape {
  cmsPageUrl: string;
  nonExistentUrl: string;
}

export interface GraCatalogDataShape {
  discovery: GraCatalogDiscoveryShape;
  plp: GraCatalogPlpShape;
  pdp: GraCatalogPdpShape;
  categories: GraCatalogCategoriesShape;
  storeConfig: GraCatalogStoreConfigShape;
  urlResolver: GraCatalogUrlResolverShape;
}

export const GraCatalogData: GraCatalogDataShape = {
  discovery: {
    searchTerm: 'shoe',
    pageSize: 5,
    brandRetryTerm: 'nike',
  },
  plp: {
    pageSize: 12,
    nonExistentSku: 'INVALID-SKU-CATALOG-TEST-99999',
  },
  pdp: {
    nonExistentUrlKey: 'this-product-does-not-exist-catalog-test-99999',
  },
  categories: {
    nonExistentCategoryId: '99999999',
  },
  storeConfig: {
    expectedLocalePattern: /^[a-z]{2}_[A-Z]{2}$/,
    expectedCurrencyCodePattern: /^[A-Z]{3}$/,
  },
  urlResolver: {
    cmsPageUrl: 'about-us',
    nonExistentUrl: 'this-page-does-not-exist-catalog-test-99999',
  },
};

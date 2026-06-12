export interface PlaCatalogDiscoveryShape {
  searchTerm: string;
  pageSize: number;
  brandRetryTerm: string;
}

export interface PlaCatalogPlpShape {
  pageSize: number;
  nonExistentSku: string;
}

export interface PlaCatalogPdpShape {
  nonExistentUrlKey: string;
}

export interface PlaCatalogCategoriesShape {
  nonExistentCategoryId: string;
}

export interface PlaCatalogStoreConfigShape {
  expectedLocalePattern: RegExp;
  expectedCurrencyCodePattern: RegExp;
}

export interface PlaCatalogUrlResolverShape {
  cmsPageUrl: string;
  nonExistentUrl: string;
}

export interface PlaCatalogDataShape {
  discovery: PlaCatalogDiscoveryShape;
  plp: PlaCatalogPlpShape;
  pdp: PlaCatalogPdpShape;
  categories: PlaCatalogCategoriesShape;
  storeConfig: PlaCatalogStoreConfigShape;
  urlResolver: PlaCatalogUrlResolverShape;
}

export const PlaCatalogData: PlaCatalogDataShape = {
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

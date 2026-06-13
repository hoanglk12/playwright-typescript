import { GraTestData, createBrandTestData } from './gra-test-data';

export interface SiteContext {
  siteCode: string;
  baseURL: string;
  testData: GraTestData;
  // Phase 2: consumed by store-header injection (NZ sites) and brand-aware assertions
  brand: string;
  storeHeader?: string;
  countryCode: string;
  currency: string;
  shippingRegion: string;
  // A search term guaranteed to return product results for this brand's catalog
  catalogSearchTerm: string;
  // Whether this brand's staging endpoint exposes the loyalty/rewards feature
  hasLoyalty: boolean;
}

export const siteRegistry: Record<string, SiteContext> = {
  'pla-au': {
    siteCode: 'pla-au',
    brand: 'platypus',
    baseURL: 'https://stag-platypus-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    catalogSearchTerm: 'shoe',
    hasLoyalty: true,
    testData: createBrandTestData('pla'),
  },
  'skx-au': {
    siteCode: 'skx-au',
    brand: 'skechers',
    baseURL: 'https://stag-skechers-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    catalogSearchTerm: 'skechers',
    hasLoyalty: true,
    testData: createBrandTestData('skx'),
  },
  'drm-au': {
    siteCode: 'drm-au',
    brand: 'drmartens',
    baseURL: 'https://stag-drmartens-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    catalogSearchTerm: 'boot',
    hasLoyalty: false,
    testData: createBrandTestData('drm'),
  },
  'van-au': {
    siteCode: 'van-au',
    brand: 'vans',
    baseURL: 'https://stag-vans-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    catalogSearchTerm: 'vans',
    hasLoyalty: false,
    testData: createBrandTestData('van'),
  },
};

import { PlaTestData, createBrandTestData } from './pla-test-data';

export interface SiteContext {
  siteCode: string;
  baseURL: string;
  testData: PlaTestData;
  // Phase 2: consumed by store-header injection (NZ sites) and brand-aware assertions
  brand: string;
  storeHeader?: string;
  countryCode: string;
  currency: string;
  shippingRegion: string;
}

export const siteRegistry: Record<string, SiteContext> = {
  'pla-au': {
    siteCode: 'pla-au',
    brand: 'platypus',
    baseURL: 'https://stag-platypus-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    testData: createBrandTestData('pla'),
  },
  'skx-au': {
    siteCode: 'skx-au',
    brand: 'skechers',
    baseURL: 'https://stag-skechers-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    testData: createBrandTestData('skx'),
  },
  'drm-au': {
    siteCode: 'drm-au',
    brand: 'drmartens',
    baseURL: 'https://stag-drmartens-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    testData: createBrandTestData('drm'),
  },
  'van-au': {
    siteCode: 'van-au',
    brand: 'vans',
    baseURL: 'https://stag-vans-au.accentgra.com/graphql',
    countryCode: 'AU',
    currency: 'AUD',
    shippingRegion: 'NSW',
    testData: createBrandTestData('van'),
  },
};

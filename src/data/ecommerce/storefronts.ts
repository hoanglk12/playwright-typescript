export interface Storefront {
  name: string;
  url: string;
  titleRegex: RegExp;
  /** AU sites earn Qantas Points; NZ sites do not (E2E-HOME-003) */
  hasQantasPoints: boolean;
  /** Expected top-nav link labels in display order (E2E-NAV-001). Empty = not yet configured for this site. */
  navLinks: readonly string[];
  /** Label of the women's category nav link; undefined if this site has no women's nav link (E2E-NAV-002) */
  womensNavLabel?: string;
  /** Label of the men's category nav link; undefined if this site has no men's nav link (E2E-NAV-003) */
  mensNavLabel?: string;
  /** Label of the kids category nav link; undefined if this site has no kids nav link (E2E-NAV-004) */
  kidsNavLabel?: string;
  /** Label of the sale category nav link (may vary: SALE, OUTLET, BLACK FRIDAY, etc.); undefined if absent (E2E-NAV-005) */
  saleNavLabel?: string;
}

export const storefronts: readonly Storefront[] = [
  {
    name: 'Platypus AU',
    url: 'https://stag-platypus-au.accentgra.com/',
    titleRegex: /platypus|home\s+page/i,
    hasQantasPoints: true,
    navLinks: ['ALL', 'PRESALE', 'WOMENS', 'MENS', 'KIDS', 'BRANDS', 'SALE'],
    womensNavLabel: 'WOMENS',
    mensNavLabel: 'MENS',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Platypus NZ',
    url: 'https://stag-platypus-nz.accentgra.com/',
    titleRegex: /platypus|home\s*page/i,
    hasQantasPoints: false,
    navLinks: ['PRESALE', 'ALL', 'MENS', 'KIDS', 'BRANDS', 'SALE'],
    // No women's nav link on Platypus NZ — excluded from E2E-NAV-002
    mensNavLabel: 'MENS',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Skechers AU',
    url: 'https://stag-skechers-au.accentgra.com/',
    titleRegex: /skechers/i,
    hasQantasPoints: true,
    navLinks: ['WOMEN', 'MENS', 'KIDS', 'CLOTHING', 'SALE'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MENS',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Skechers NZ',
    url: 'https://stag-skechers-nz.accentgra.com/',
    titleRegex: /skechers/i,
    hasQantasPoints: false,
    navLinks: ['WOMEN', 'MENS', 'KIDS', 'SALE'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MENS',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Vans AU',
    url: 'https://stag-vans-au.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    hasQantasPoints: true,
    // CLOTHING is a dropdown trigger with no <a> tag — excluded from nav link assertions
    navLinks: ['WOMEN', 'MEN', 'KIDS', 'OUTLET'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MEN',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'OUTLET',  // OUTLET navigates to /shop/sale
  },
  {
    name: 'Vans NZ',
    url: 'https://stag-vans-nz.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    hasQantasPoints: false,
    navLinks: ['WOMEN', 'MEN', 'KIDS', 'SALE'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MEN',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Dr. Martens AU',
    url: 'https://stag-drmartens-au.accentgra.com/',
    titleRegex: /dr\.?\s?martens|drmartens/i,
    hasQantasPoints: true,
    navLinks: ['ALL', 'WOMEN', 'MEN', 'KIDS', 'SALE'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MEN',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'SALE',
  },
  {
    name: 'Dr. Martens NZ',
    url: 'https://stag-drmartens-nz.accentgra.com/',
    titleRegex: /dr\.?\s?martens|drmartens/i,
    hasQantasPoints: false,
    // BLACK FRIDAY is a staging promotional link pointing to /shop/sale
    navLinks: ['ALL', 'WOMEN', 'MEN', 'KIDS', 'BLACK FRIDAY'],
    womensNavLabel: 'WOMEN',
    mensNavLabel: 'MEN',
    kidsNavLabel: 'KIDS',
    saleNavLabel: 'BLACK FRIDAY',  // staging seasonal label — navigates to /shop/sale
  },
];
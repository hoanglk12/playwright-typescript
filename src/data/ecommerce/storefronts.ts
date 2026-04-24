export interface Storefront {
  name: string;
  url: string;
  titleRegex: RegExp;
  /** AU sites earn Qantas Points; NZ sites do not (E2E-HOME-003) */
  hasQantasPoints: boolean;
  /** Expected top-nav link labels in display order (E2E-NAV-001). Empty = not yet configured for this site. */
  navLinks: readonly string[];
}

export const storefronts: readonly Storefront[] = [
  {
    name: 'Platypus AU',
    url: 'https://stag-platypus-au.accentgra.com/',
    titleRegex: /platypus|home\s+page/i,
    hasQantasPoints: true,
    navLinks: ['ALL', 'PRESALE', 'WOMENS', 'MENS', 'KIDS', 'BRANDS', 'SALE'],
  },
  {
    name: 'Platypus NZ',
    url: 'https://stag-platypus-nz.accentgra.com/',
    titleRegex: /platypus|home\s*page/i,
    hasQantasPoints: false,
    navLinks: ['PRESALE', 'ALL', 'MENS', 'KIDS', 'BRANDS', 'SALE'],
  },
  {
    name: 'Skechers AU',
    url: 'https://stag-skechers-au.accentgra.com/',
    titleRegex: /skechers/i,
    hasQantasPoints: true,
    navLinks: ['WOMEN', 'MENS', 'KIDS', 'CLOTHING', 'SALE'],
  },
  {
    name: 'Skechers NZ',
    url: 'https://stag-skechers-nz.accentgra.com/',
    titleRegex: /skechers/i,
    hasQantasPoints: false,
    navLinks: ['WOMEN', 'MENS', 'KIDS', 'SALE'],
  },
  // TODO(E2E-NAV): populate navLinks once nav is configured on staging — these sites are excluded from the nav smoke suite
  {
    name: 'Vans AU',
    url: 'https://stag-vans-au.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    hasQantasPoints: true,
    navLinks: [],
  },
  {
    name: 'Vans NZ',
    url: 'https://stag-vans-nz.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    hasQantasPoints: false,
    navLinks: [],
  },
  {
    name: 'Dr. Martens AU',
    url: 'https://stag-drmartens-au.accentgra.com/',
    titleRegex: /dr\.?\s?martens|drmartens/i,
    hasQantasPoints: true,
    navLinks: [],
  },
];
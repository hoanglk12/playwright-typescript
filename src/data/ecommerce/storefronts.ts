export interface Storefront {
  name: string;
  url: string;
  titleRegex: RegExp;
}

export const storefronts: Storefront[] = [
  {
    name: 'Platypus AU',
    url: 'https://stag-platypus-au.accentgra.com/',
    titleRegex: /platypus|home\s+page/i,
  },
  {
    name: 'Platypus NZ',
    url: 'https://stag-platypus-nz.accentgra.com/',
    titleRegex: /platypus|home\s*page/i,
  },
  {
    name: 'Skechers AU',
    url: 'https://stag-skechers-au.accentgra.com/',
    titleRegex: /skechers/i,
  },
  {
    name: 'Skechers NZ',
    url: 'https://stag-skechers-nz.accentgra.com/',
    titleRegex: /skechers/i,
  },
  {
    name: 'Vans AU',
    url: 'https://stag-vans-au.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
  },
  {
    name: 'Vans NZ',
    url: 'https://stag-vans-nz.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
  },
  {
    name: 'Dr. Martens AU',
    url: 'https://stag-drmartens-au.accentgra.com/',
    titleRegex: /dr\.?\s?martens|drmartens/i,
  },
];
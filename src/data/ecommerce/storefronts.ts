export interface Storefront {
  name: string;
  url: string;
  titleRegex: RegExp;
  promoRegex: RegExp;
}

export const storefronts: Storefront[] = [
  {
    name: 'Platypus AU',
    url: 'https://stag-platypus-au.accentgra.com/',
    titleRegex: /platypus|home\s+page/i,
    promoRegex: /qantas\s+points|hottest\s+under\s*\$?100|buy\s*2\s*get\s*20%\s*off|pre\s*-?\s*sale/i,
  },
  {
    name: 'Platypus NZ',
    url: 'https://stag-platypus-nz.accentgra.com/',
    titleRegex: /platypus|home\s*page/i,
    promoRegex: /kicks\s+club\s+ft\.?\s+asics|join\s+now|pre\s*-?\s*sale/i,
  },
  {
    name: 'Skechers AU',
    url: 'https://stag-skechers-au.accentgra.com/',
    titleRegex: /skechers/i,
    promoRegex: /shop\s+(?:sale|now|women|men|all)|free\s+(?:shipping|delivery|returns)|skechers|sale|new\s+arrivals/i,
  },
  {
    name: 'Skechers NZ',
    url: 'https://stag-skechers-nz.accentgra.com/',
    titleRegex: /skechers/i,
    promoRegex: /spend\s*&\s*save|shop\s+sale|outlet\s+clothing/i,
  },
  {
    name: 'Vans AU',
    url: 'https://stag-vans-au.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    promoRegex: /qantas\s+points|shop\s+(?:now|sale|men|women|all)|free\s+(?:shipping|delivery|returns)|new\s+arrivals|vans/i,
  },
  {
    name: 'Vans NZ',
    url: 'https://stag-vans-nz.accentgra.com/',
    titleRegex: /vans|home\s+page/i,
    promoRegex: /shop\s+(?:mens|women|men|all\s+sale|now|sale)|free\s+(?:shipping|delivery|returns)|new\s+arrivals|vans/i,
  },
  {
    name: 'Dr. Martens AU',
    url: 'https://stag-drmartens-au.accentgra.com/',
    titleRegex: /dr\.?\s?martens|drmartens/i,
    promoRegex: /qantas\s+points|sign[\s-]*up\s+now|shop\s+sale|shop\s+now/i,
  },
];
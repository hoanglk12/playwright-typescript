# Storefront Summary

Quick reference for all 8 storefronts in `src/data/ecommerce/storefronts.ts`.

## Capabilities per Storefront

| # | Name | Qantas | womens | mens | kids | sale | search |
|---|------|--------|--------|------|------|------|--------|
| 1 | Platypus AU | ✓ | WOMENS | MENS | KIDS | SALE | Nike |
| 2 | Platypus NZ | — | — | MENS | KIDS | SALE | Nike |
| 3 | Skechers AU | ✓ | WOMEN | MENS | KIDS | SALE | Go Walk |
| 4 | Skechers NZ | — | WOMEN | MENS | KIDS | SALE | Go Walk |
| 5 | Vans AU | ✓ | WOMEN | MEN | KIDS | OUTLET | Old Skool |
| 6 | Vans NZ | — | WOMEN | MEN | KIDS | SALE | Old Skool |
| 7 | Dr. Martens AU | ✓ | WOMEN | MEN | KIDS | SALE | 1460 |
| 8 | Dr. Martens NZ | — | WOMEN | MEN | KIDS | BLACK FRIDAY | 1460 |

## URLs (staging)

| Name | URL |
|---|---|
| Platypus AU | `https://stag-platypus-au.accentgra.com/` |
| Platypus NZ | `https://stag-platypus-nz.accentgra.com/` |
| Skechers AU | `https://stag-skechers-au.accentgra.com/` |
| Skechers NZ | `https://stag-skechers-nz.accentgra.com/` |
| Vans AU | `https://stag-vans-au.accentgra.com/` |
| Vans NZ | `https://stag-vans-nz.accentgra.com/` |
| Dr. Martens AU | `https://stag-drmartens-au.accentgra.com/` |
| Dr. Martens NZ | `https://stag-drmartens-nz.accentgra.com/` |

## Test-driving notes

- **Platypus AU/NZ search** — URL may land on `/search?q=` OR `/shop/<brand>` (brand redirect)
- **Vans AU** — `CLOTHING` nav item is a dropdown trigger with no `<a>` tag; excluded from nav assertions; sale label is `OUTLET`
- **Dr. Martens NZ** — sale label is `BLACK FRIDAY` (staging seasonal label), navigates to `/shop/sale`
- **Platypus NZ** — no `womensNavLabel`; PDP/PLP nav flows use `mensNavLabel` or `saleNavLabel` instead
- **`pdpPath`** on each storefront is a placeholder — all `TODO` values need replacing with real product slugs before direct-navigation tests can run

## Category + size filters (PLP tests)

| Name | Category filter | Size filter |
|---|---|---|
| Platypus AU | Footwear | 7 |
| Platypus NZ | Footwear | 7 |
| Skechers AU | Footwear | 7 |
| Skechers NZ | Footwear | 7 |
| Vans AU | Low Top | 7 |
| Vans NZ | Old Skool | 7 |
| Dr. Martens AU | Boots | 4 |
| Dr. Martens NZ | Boots | 4 |

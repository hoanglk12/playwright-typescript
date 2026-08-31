import * as z from 'zod';
import { MoneySchema, Money } from './gra-common-schemas';

/**
 * Zod schemas for GRA Catalog GraphQL responses (`data` field) — Phase 3.
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * Scope is PLP_QUERY and GetProductDetail (PDP_QUERY) from tests/api/gra-catalog.spec.ts only.
 * DISCOVER_PRODUCTS_QUERY, CATEGORIES_QUERY, STORE_CONFIG_QUERY and URL_RESOLVER_QUERY are out
 * of scope for Phase 3 (see docs/technical-research/zod-schema-validation-gra-rollout.research.html).
 *
 * Evidence (throwaway diagnostic, 2026-08-31, all 8 brand projects):
 *  - PLP: 160 items sampled per brand (960 total, 2 search terms x 2 pages x pageSize 40).
 *    Null array elements were observed on pla-nz (8/160), drm-au (1/160), drm-nz (1/160), always
 *    paired with a `price_range` GraphQL error at that index — confirming a broken price_range
 *    nulls the whole `items[n]` element, not just the field (matches TC_03/TC_04's existing
 *    `item != null` filter and assertNoCriticalErrors' price_range tolerance).
 *  - Inside every surviving (non-null) item across all 960 samples, `price_range`,
 *    `minimum_price`, and `minimum_price.final_price` were never null — 0/960. This is consistent
 *    with `price_range` being non-null in the underlying schema, which is exactly why a broken
 *    price forces the nearest nullable ancestor (`items[n]`) to null instead.
 *  - `page_info` (`total_pages`, `current_page`, `page_size`, `__typename`) was populated on
 *    every sampled page across all 8 brands.
 *  - PDP: 48 products probed (6 url_keys x 8 brands, drawn from the PLP sample above). 0 null
 *    array elements, 0 null `price_range`/`minimum_price`/`maximum_price`/`regular_price` across
 *    all 48 — kept required for PDP, unlike PLP's array elements, since no null was observed at
 *    the PDP single-product level in this sample. Revisit if a future run observes otherwise.
 *  - All 48 probed PDP products came back `__typename: "ConfigurableProduct"` with non-empty
 *    `variants`/`configurable_options` — no SimpleProduct was observed, so those two fields stay
 *    `.optional()` on the item (inline-fragment fields, per Rule 05/Option "one looseObject per
 *    operation"), not asserted absent.
 */

const ProductListPriceRangeSchema = z.looseObject({
  minimum_price: z.looseObject({
    final_price: MoneySchema,
    __typename: z.string(),
  }),
  __typename: z.string(),
});

export interface ProductListItem {
  sku: string;
  name: string;
  url_key: string;
  stock_status: string;
  price_range: {
    minimum_price: {
      final_price: Money;
      __typename: string;
    };
    __typename: string;
  };
  __typename: string;
}

const ProductListItemSchema: z.ZodType<ProductListItem> = z.looseObject({
  sku: z.string(),
  name: z.string(),
  url_key: z.string(),
  stock_status: z.string(),
  price_range: ProductListPriceRangeSchema,
  __typename: z.string(),
});

export interface ProductListPageInfo {
  total_pages: number;
  current_page: number;
  page_size: number;
  __typename: string;
}

const ProductListPageInfoSchema: z.ZodType<ProductListPageInfo> = z.looseObject({
  total_pages: z.number(),
  current_page: z.number(),
  page_size: z.number(),
  __typename: z.string(),
});

export interface GetProductListData {
  products: {
    total_count: number;
    page_info: ProductListPageInfo;
    items: (ProductListItem | null)[];
    __typename: string;
  };
}

// items array elements are nullable — evidence above (pla-nz/drm-au/drm-nz all observed a null
// element paired with a price_range error). page_info is required — observed populated on every
// sampled page across all 8 brands.
export const GetProductListDataSchema: z.ZodType<GetProductListData> = z.looseObject({
  products: z.looseObject({
    total_count: z.number(),
    page_info: ProductListPageInfoSchema,
    items: z.array(ProductListItemSchema.nullable()),
    __typename: z.string(),
  }),
});

export interface ConfigurableOptionValue {
  value_index: number;
  label: string;
  __typename: string;
}

export interface ConfigurableOption {
  id: number;
  label: string;
  values: ConfigurableOptionValue[];
  __typename: string;
}

export interface ConfigurableVariant {
  product: {
    sku: string;
    stock_status: string;
    __typename: string;
  };
  __typename: string;
}

const ConfigurableOptionValueSchema: z.ZodType<ConfigurableOptionValue> = z.looseObject({
  value_index: z.number(),
  label: z.string(),
  __typename: z.string(),
});

const ConfigurableOptionSchema: z.ZodType<ConfigurableOption> = z.looseObject({
  id: z.number(),
  label: z.string(),
  values: z.array(ConfigurableOptionValueSchema),
  __typename: z.string(),
});

const ConfigurableVariantSchema: z.ZodType<ConfigurableVariant> = z.looseObject({
  product: z.looseObject({
    sku: z.string(),
    stock_status: z.string(),
    __typename: z.string(),
  }),
  __typename: z.string(),
});

const ProductDetailPriceRangeSchema = z.looseObject({
  minimum_price: z.looseObject({
    final_price: MoneySchema,
    regular_price: MoneySchema,
    __typename: z.string(),
  }),
  maximum_price: z.looseObject({
    final_price: MoneySchema,
    __typename: z.string(),
  }),
  __typename: z.string(),
});

export interface ProductDetailItem {
  sku: string;
  name: string;
  url_key: string;
  stock_status: string;
  price_range: {
    minimum_price: {
      final_price: Money;
      regular_price: Money;
      __typename: string;
    };
    maximum_price: {
      final_price: Money;
      __typename: string;
    };
    __typename: string;
  };
  configurable_options?: ConfigurableOption[];
  variants?: ConfigurableVariant[];
  __typename: string;
}

// configurable_options/variants are `... on ConfigurableProduct` inline-fragment fields —
// .optional() rather than .nullable(), since a SimpleProduct simply omits the fields (never
// observed in the 48-sample probe, but Rule 05's own reasoning for products applies here too:
// don't assert a shape this suite has never seen a counter-example for).
const ProductDetailItemSchema: z.ZodType<ProductDetailItem> = z.looseObject({
  sku: z.string(),
  name: z.string(),
  url_key: z.string(),
  stock_status: z.string(),
  price_range: ProductDetailPriceRangeSchema,
  configurable_options: z.array(ConfigurableOptionSchema).optional(),
  variants: z.array(ConfigurableVariantSchema).optional(),
  __typename: z.string(),
});

export interface GetProductDetailData {
  products: {
    total_count: number;
    items: ProductDetailItem[];
    __typename: string;
  };
}

// PDP items[] elements are kept required (not .nullable()) — 0/48 null elements observed at the
// single-product PDP level, unlike PLP's list-level nulling. Revisit if evidence changes.
export const GetProductDetailDataSchema: z.ZodType<GetProductDetailData> = z.looseObject({
  products: z.looseObject({
    total_count: z.number(),
    items: z.array(ProductDetailItemSchema),
    __typename: z.string(),
  }),
});

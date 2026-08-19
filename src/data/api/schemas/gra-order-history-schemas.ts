import * as z from 'zod';
import { CustomerOrderItem, CustomerOrderShape, CustomerOrdersShape } from '../gra-order-history-data';

/**
 * Zod schema for GRA Order History GraphQL responses (`data` field).
 * z.looseObject throughout — unknown keys are additive API evolution, not a test failure.
 *
 * Reuses CustomerOrderItem/CustomerOrderShape/CustomerOrdersShape from gra-order-history-data.ts
 * rather than re-declaring them — that data module is the existing single source of truth for
 * this GraphQL selection's shape, already used directly by the spec itself.
 *
 * grand_total is a plain Float scalar on CustomerOrder (not a Money object) per the spec's own
 * staging notes. TC_04 (unauthenticated) and TC_05 (guestOrder, invalid token or schema gap)
 * are error-path/schema-gap tests with no successful `data` shape to validate — not schema'd
 * here, per Mechanical rule B.
 */

const CustomerOrderItemSchema: z.ZodType<CustomerOrderItem> = z.looseObject({
  product_name: z.string(),
  product_sku: z.string(),
  quantity_ordered: z.number(),
  __typename: z.string(),
});

const CustomerOrderSchema: z.ZodType<CustomerOrderShape> = z.looseObject({
  number: z.string(),
  status: z.string(),
  grand_total: z.number(),
  items: z.array(CustomerOrderItemSchema),
  __typename: z.string(),
});

const CustomerOrdersSchema: z.ZodType<CustomerOrdersShape> = z.looseObject({
  items: z.array(CustomerOrderSchema),
  total_count: z.number(),
  __typename: z.string(),
});

export interface GetCustomerOrdersData {
  customer: {
    orders: CustomerOrdersShape;
  };
}

export const GetCustomerOrdersDataSchema: z.ZodType<GetCustomerOrdersData> = z.looseObject({
  customer: z.looseObject({
    orders: CustomerOrdersSchema,
  }),
});

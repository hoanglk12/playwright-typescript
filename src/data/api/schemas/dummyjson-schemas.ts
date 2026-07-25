import * as z from 'zod';
import {
  Product,
  ProductsListResponse,
  CartProduct,
  Cart,
  CartsListResponse,
  User,
  UsersListResponse,
  AuthUser,
  AuthResponse,
  RefreshTokenResponse,
  DeletedResource,
} from '../../../api/services/dummyjson';

/**
 * Zod schemas mirroring src/api/services/dummyjson/models.ts.
 * Ground rules (per Zod pilot plan):
 * - Always z.looseObject — unknown keys are additive API evolution, not a test failure.
 * - Never z.coerce.* — coercion would mask the exact type drift schemas exist to catch.
 * - .optional() mirrors the source interface exactly.
 * - Each schema carries a z.ZodType<Interface> annotation to bind schema to the
 *   hand-written interface without relying on z.infer (interfaces stay authoritative).
 */

export const ProductSchema: z.ZodType<Product> = z.looseObject({
  id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number(),
  stock: z.number().optional(),
  brand: z.string().optional(),
  isDeleted: z.boolean().optional(),
  deletedOn: z.string().optional(),
});

export const ProductsListSchema: z.ZodType<ProductsListResponse> = z.looseObject({
  products: z.array(ProductSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

// Product as returned by the simulated DELETE endpoint — isDeleted/deletedOn are
// required here even though they're optional on the base Product interface.
// Written out explicitly (not ProductSchema.extend(...)) since a z.ZodType<Product>
// annotation erases the underlying ZodObject type that .extend() needs.
export const ProductDeletedSchema: z.ZodType<Product & DeletedResource> = z.looseObject({
  id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.number(),
  stock: z.number().optional(),
  brand: z.string().optional(),
  isDeleted: z.boolean(),
  deletedOn: z.string(),
});

export const CartProductSchema: z.ZodType<CartProduct> = z.looseObject({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  quantity: z.number(),
  total: z.number(),
  discountPercentage: z.number(),
  discountedTotal: z.number(),
  thumbnail: z.string().optional(),
});

export const CartSchema: z.ZodType<Cart> = z.looseObject({
  id: z.number(),
  products: z.array(CartProductSchema),
  total: z.number(),
  discountedTotal: z.number(),
  userId: z.number(),
  totalProducts: z.number(),
  totalQuantity: z.number(),
  isDeleted: z.boolean().optional(),
  deletedOn: z.string().optional(),
});

export const CartsListSchema: z.ZodType<CartsListResponse> = z.looseObject({
  carts: z.array(CartSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

// Cart as returned by the simulated DELETE endpoint — isDeleted/deletedOn are
// required here even though they're optional on the base Cart interface.
// Written out explicitly (not CartSchema.extend(...)) since a z.ZodType<Cart>
// annotation erases the underlying ZodObject type that .extend() needs.
export const CartDeletedSchema: z.ZodType<Cart & DeletedResource> = z.looseObject({
  id: z.number(),
  products: z.array(CartProductSchema),
  total: z.number(),
  discountedTotal: z.number(),
  userId: z.number(),
  totalProducts: z.number(),
  totalQuantity: z.number(),
  isDeleted: z.boolean(),
  deletedOn: z.string(),
});

export const UserSchema: z.ZodType<User> = z.looseObject({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  username: z.string().optional(),
  age: z.number().optional(),
  isDeleted: z.boolean().optional(),
  deletedOn: z.string().optional(),
});

export const UsersListSchema: z.ZodType<UsersListResponse> = z.looseObject({
  users: z.array(UserSchema),
  total: z.number(),
  skip: z.number(),
  limit: z.number(),
});

// User as returned by the simulated DELETE endpoint — isDeleted/deletedOn are
// required here even though they're optional on the base User interface.
// Written out explicitly (not UserSchema.extend(...)) since a z.ZodType<User>
// annotation erases the underlying ZodObject type that .extend() needs.
export const UserDeletedSchema: z.ZodType<User & DeletedResource> = z.looseObject({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  username: z.string().optional(),
  age: z.number().optional(),
  isDeleted: z.boolean(),
  deletedOn: z.string(),
});

export const AuthUserSchema: z.ZodType<AuthUser> = z.looseObject({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string(),
  image: z.string(),
});

// Written out explicitly (not AuthUserSchema.extend(...)) to avoid depending on
// .extend() preserving looseObject's catchall behaviour across a base/derived pair.
export const AuthResponseSchema: z.ZodType<AuthResponse> = z.looseObject({
  id: z.number(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  gender: z.string(),
  image: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const RefreshTokenResponseSchema: z.ZodType<RefreshTokenResponse> = z.looseObject({
  accessToken: z.string(),
  refreshToken: z.string(),
});

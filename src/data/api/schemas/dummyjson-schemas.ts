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
 * - Always z.looseObject — unknown keys are additive API evolution, not a test failure.
 * - Never z.coerce.* — coercion would mask the exact type drift schemas exist to catch.
 * - Each schema carries a z.ZodType<Interface> annotation rather than deriving types via
 *   z.infer, so the hand-written interfaces stay authoritative.
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

// Returned by the simulated DELETE endpoint. Written out rather than ProductSchema.extend(...)
// since the z.ZodType<Product> annotation erases the ZodObject type .extend() needs.
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

// Returned by the simulated DELETE endpoint. Written out rather than CartSchema.extend(...)
// since the z.ZodType<Cart> annotation erases the ZodObject type .extend() needs.
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

// Returned by the simulated DELETE endpoint. Written out rather than UserSchema.extend(...)
// since the z.ZodType<User> annotation erases the ZodObject type .extend() needs.
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

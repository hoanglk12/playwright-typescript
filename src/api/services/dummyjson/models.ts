/**
 * Login request model
 * POST /auth/login
 */
export interface LoginRequest {
  username: string;
  password: string;
  expiresInMins?: number;
}

/**
 * Authenticated user fields shared by /auth/login and /auth/me
 */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  image: string;
}

/**
 * Auth response model
 * Returned by POST /auth/login
 */
export interface AuthResponse extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

/**
 * Refresh token request model
 * POST /auth/refresh
 */
export interface RefreshTokenRequest {
  refreshToken: string;
  expiresInMins?: number;
}

/**
 * Refresh token response model
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Product model
 * GET /products, /products/{id}, /products/search
 */
export interface Product {
  id: number;
  title: string;
  description?: string;
  category?: string;
  price: number;
  stock?: number;
  brand?: string;
  isDeleted?: boolean;
  deletedOn?: string;
}

/**
 * Products list response model
 * GET /products, /products/search
 */
export interface ProductsListResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Add product request model
 * POST /products/add
 */
export interface AddProductRequest {
  title: string;
  price?: number;
  category?: string;
}

/**
 * Update product request model
 * PUT /products/{id}
 */
export interface UpdateProductRequest {
  title?: string;
  price?: number;
  category?: string;
}

/**
 * Cart product input model
 * Used when adding/updating a cart
 */
export interface CartProductInput {
  id: number;
  quantity: number;
}

/**
 * Cart product model (enriched line item as returned by the API)
 */
export interface CartProduct {
  id: number;
  title: string;
  price: number;
  quantity: number;
  total: number;
  discountPercentage: number;
  discountedTotal: number;
  thumbnail?: string;
}

/**
 * Cart model
 * GET /carts/{id}, /carts/user/{userId}
 */
export interface Cart {
  id: number;
  products: CartProduct[];
  total: number;
  discountedTotal: number;
  userId: number;
  totalProducts: number;
  totalQuantity: number;
  isDeleted?: boolean;
  deletedOn?: string;
}

/**
 * Carts list response model
 * GET /carts, /carts/user/{userId}
 */
export interface CartsListResponse {
  carts: Cart[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Add cart request model
 * POST /carts/add
 */
export interface AddCartRequest {
  userId: number;
  products: CartProductInput[];
}

/**
 * Update cart request model
 * PUT /carts/{id}
 */
export interface UpdateCartRequest {
  merge?: boolean;
  products?: CartProductInput[];
}

/**
 * User model
 * GET /users/{id}, /users/search
 */
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  username?: string;
  age?: number;
  isDeleted?: boolean;
  deletedOn?: string;
}

/**
 * Users list response model
 * GET /users, /users/search
 */
export interface UsersListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Add user request model
 * POST /users/add
 */
export interface AddUserRequest {
  firstName: string;
  lastName: string;
  age?: number;
  email?: string;
}

/**
 * Update user request model
 * PUT /users/{id}
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  age?: number;
}

/**
 * Deleted resource marker fields
 * Present on the response of any simulated DELETE endpoint
 */
export interface DeletedResource {
  isDeleted: boolean;
  deletedOn: string;
}

/**
 * Query params accepted by the list endpoints (/products, /users)
 */
export interface ListQueryParams {
  limit?: number;
  skip?: number;
}

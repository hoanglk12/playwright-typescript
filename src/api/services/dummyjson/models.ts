/** POST /auth/login */
export interface LoginRequest {
  username: string;
  password: string;
  expiresInMins?: number;
}

/** Authenticated user fields shared by /auth/login and /auth/me */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  image: string;
}

/** Returned by POST /auth/login */
export interface AuthResponse extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

/** POST /auth/refresh */
export interface RefreshTokenRequest {
  refreshToken: string;
  expiresInMins?: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

/** GET /products, /products/{id}, /products/search */
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

/** GET /products, /products/search */
export interface ProductsListResponse {
  products: Product[];
  total: number;
  skip: number;
  limit: number;
}

/** POST /products/add */
export interface AddProductRequest {
  title: string;
  price?: number;
  category?: string;
}

/** PUT /products/{id} */
export interface UpdateProductRequest {
  title?: string;
  price?: number;
  category?: string;
}

/** Used when adding/updating a cart */
export interface CartProductInput {
  id: number;
  quantity: number;
}

/** Cart product model (enriched line item as returned by the API) */
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

/** GET /carts/{id}, /carts/user/{userId} */
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

/** GET /carts, /carts/user/{userId} */
export interface CartsListResponse {
  carts: Cart[];
  total: number;
  skip: number;
  limit: number;
}

/** POST /carts/add */
export interface AddCartRequest {
  userId: number;
  products: CartProductInput[];
}

/** PUT /carts/{id} */
export interface UpdateCartRequest {
  merge?: boolean;
  products?: CartProductInput[];
}

/** GET /users/{id}, /users/search */
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

/** GET /users, /users/search */
export interface UsersListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

/** POST /users/add */
export interface AddUserRequest {
  firstName: string;
  lastName: string;
  age?: number;
  email?: string;
}

/** PUT /users/{id} */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  age?: number;
}

/** Present on the response of any simulated DELETE endpoint */
export interface DeletedResource {
  isDeleted: boolean;
  deletedOn: string;
}

/** Query params accepted by the list endpoints (/products, /users) */
export interface ListQueryParams {
  limit?: number;
  skip?: number;
}

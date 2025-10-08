import { APIRequestContext, APIResponse, request } from '@playwright/test';
import { ApiClient, ApiClientOptions, AuthType } from './ApiClient';
import { GraphQLResponseWrapper } from './GraphQLResponse';

/**
 * GraphQL Query/Mutation structure
 */
export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

/**
 * GraphQL Response structure
 */
export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
  }>;
}

/**
 * Options for GraphQL client configuration
 */
export interface GraphQLClientOptions extends ApiClientOptions {
  endpoint?: string; // GraphQL endpoint path (default: '/graphql')
  enableIntrospection?: boolean;
  batchingEnabled?: boolean;
  maxBatchSize?: number;
}

/**
 * GraphQL Client for handling GraphQL queries and mutations
 * Extends the base ApiClient to maintain architectural consistency
 */
export class GraphQLClient extends ApiClient {
  private endpoint: string;
  private enableIntrospection: boolean;
  private batchingEnabled: boolean;
  private maxBatchSize: number;
  private batchQueue: GraphQLRequest[] = [];

  /**
   * Creates a new GraphQL client instance
   * @param options - Configuration options for the GraphQL client
   */
  constructor(options: GraphQLClientOptions) {
    super(options);
    this.endpoint = options.endpoint || '/graphql';
    this.enableIntrospection = options.enableIntrospection ?? true;
    this.batchingEnabled = options.batchingEnabled ?? false;
    this.maxBatchSize = options.maxBatchSize ?? 10;
  }

  /**
   * Execute a GraphQL query
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @param operationName - Optional operation name
   * @returns API response
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<APIResponse> {
    const graphqlRequest: GraphQLRequest = {
      query,
      variables,
      operationName
    };

    return await this.post(this.endpoint, graphqlRequest, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Execute a GraphQL mutation
   * @param mutation - GraphQL mutation string
   * @param variables - Mutation variables
   * @param operationName - Optional operation name
   * @returns API response
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<APIResponse> {
    const graphqlRequest: GraphQLRequest = {
      query: mutation,
      variables,
      operationName
    };

    return await this.post(this.endpoint, graphqlRequest, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Execute a GraphQL subscription
   * Note: This is a basic implementation. For real-time subscriptions, consider using WebSocket
   * @param subscription - GraphQL subscription string
   * @param variables - Subscription variables
   * @returns API response
   */
  async subscribe(
    subscription: string,
    variables?: Record<string, any>
  ): Promise<APIResponse> {
    console.warn('⚠️ Subscriptions over HTTP are not fully supported. Consider using WebSocket for real-time updates.');
    
    const graphqlRequest: GraphQLRequest = {
      query: subscription,
      variables
    };

    return await this.post(this.endpoint, graphqlRequest, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Perform GraphQL introspection to get schema information
   * @returns Schema introspection data
   */
  async introspect(): Promise<APIResponse> {
    if (!this.enableIntrospection) {
      throw new Error('Introspection is disabled for this client');
    }

    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args {
              ...InputValue
            }
          }
        }
      }
      
      fragment FullType on __Type {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          ...InputValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }
      
      fragment InputValue on __InputValue {
        name
        description
        type { ...TypeRef }
        defaultValue
      }
      
      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    return await this.query(introspectionQuery);
  }

  /**
   * Add a request to the batch queue
   * @param request - GraphQL request to batch
   */
  addToBatch(request: GraphQLRequest): void {
    if (!this.batchingEnabled) {
      throw new Error('Batching is not enabled for this client');
    }

    this.batchQueue.push(request);
  }

  /**
   * Execute all batched requests
   * @returns Array of API responses
   */
  async executeBatch(): Promise<APIResponse> {
    if (!this.batchingEnabled) {
      throw new Error('Batching is not enabled for this client');
    }

    if (this.batchQueue.length === 0) {
      throw new Error('No requests in batch queue');
    }

    if (this.batchQueue.length > this.maxBatchSize) {
      throw new Error(`Batch size exceeds maximum (${this.maxBatchSize})`);
    }

    const batch = [...this.batchQueue];
    this.batchQueue = []; // Clear queue

    return await this.post(this.endpoint, batch, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Clear the batch queue without executing
   */
  clearBatch(): void {
    this.batchQueue = [];
  }

  /**
   * Get the current batch queue size
   * @returns Number of requests in queue
   */
  getBatchSize(): number {
    return this.batchQueue.length;
  }

  /**
   * Parse GraphQL response and extract data or errors
   * @param response - API response from GraphQL endpoint
   * @returns Parsed GraphQL response
   */
  async parseGraphQLResponse<T = any>(response: APIResponse): Promise<GraphQLResponse<T>> {
    const body = await response.json();
    return body as GraphQLResponse<T>;
  }

  /**
   * Check if GraphQL response has errors
   * @param response - GraphQL response
   * @returns true if response contains errors
   */
  hasErrors(response: GraphQLResponse): boolean {
    return !!response.errors && response.errors.length > 0;
  }

  /**
   * Get error messages from GraphQL response
   * @param response - GraphQL response
   * @returns Array of error messages
   */
  getErrorMessages(response: GraphQLResponse): string[] {
    if (!this.hasErrors(response)) {
      return [];
    }
    return response.errors!.map(error => error.message);
  }

  /**
   * Wrap APIResponse in GraphQLResponseWrapper
   * @param response - Playwright APIResponse
   * @returns Wrapped GraphQL response with assertion methods
   */
  wrapResponse(response: APIResponse): GraphQLResponseWrapper {
    return new GraphQLResponseWrapper(response);
  }

  /**
   * Execute query and return wrapped response
   * @param query - GraphQL query string
   * @param variables - Query variables
   * @param operationName - Operation name
   * @returns Wrapped GraphQL response
   */
  async queryWrapped<T = any>(
    query: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<GraphQLResponseWrapper> {
    const response = await this.query<T>(query, variables, operationName);
    return this.wrapResponse(response);
  }

  /**
   * Execute mutation and return wrapped response
   * @param mutation - GraphQL mutation string
   * @param variables - Mutation variables
   * @param operationName - Operation name
   * @returns Wrapped GraphQL response
   */
  async mutateWrapped<T = any>(
    mutation: string,
    variables?: Record<string, any>,
    operationName?: string
  ): Promise<GraphQLResponseWrapper> {
    const response = await this.mutate<T>(mutation, variables, operationName);
    return this.wrapResponse(response);
  }
}

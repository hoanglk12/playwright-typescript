import { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { ApiResponseWrapper } from './ApiResponse';
import { GraphQLResponse } from './GraphQLClient';

/**
 * GraphQL Response wrapper extending ApiResponseWrapper
 * Provides GraphQL-specific assertion and utility methods
 */
export class GraphQLResponseWrapper extends ApiResponseWrapper {
  private graphqlResponse?: GraphQLResponse;

  /**
   * Get the GraphQL response structure
   * @returns Parsed GraphQL response with data and errors
   */
  public async getGraphQLResponse<T = any>(): Promise<GraphQLResponse<T>> {
    if (!this.graphqlResponse) {
      this.graphqlResponse = await this.json<GraphQLResponse<T>>();
    }
    return this.graphqlResponse as GraphQLResponse<T>;
  }

  /**
   * Get the data from GraphQL response
   * @returns Data portion of GraphQL response
   */
  public async getData<T = any>(): Promise<T | undefined> {
    const response = await this.getGraphQLResponse<T>();
    return response.data;
  }

  /**
   * Get errors from GraphQL response
   * @returns Array of GraphQL errors or undefined
   */
  public async getErrors(): Promise<GraphQLResponse['errors']> {
    const response = await this.getGraphQLResponse();
    return response.errors;
  }

  /**
   * Check if the GraphQL response has errors
   * @returns true if response contains errors
   */
  public async hasErrors(): Promise<boolean> {
    const errors = await this.getErrors();
    return !!errors && errors.length > 0;
  }

  /**
   * Get error messages as an array of strings
   * @returns Array of error messages
   */
  public async getErrorMessages(): Promise<string[]> {
    const errors = await this.getErrors();
    if (!errors) return [];
    return errors.map(error => error.message);
  }

  /**
   * Assert that the GraphQL response has no errors
   */
  public async assertNoErrors(): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeUndefined();
    return this;
  }

  /**
   * Assert that the GraphQL response has errors
   */
  public async assertHasErrors(): Promise<this> {
    const hasErrors = await this.hasErrors();
    expect(hasErrors).toBe(true);
    return this;
  }

  /**
   * Assert that the GraphQL response contains a specific error message
   * @param expectedMessage - Expected error message (partial match)
   */
  public async assertErrorMessage(expectedMessage: string): Promise<this> {
    const messages = await this.getErrorMessages();
    const hasMessage = messages.some(msg => msg.includes(expectedMessage));
    expect(hasMessage).toBe(true);
    return this;
  }

  /**
   * Assert that the GraphQL response data contains expected properties
   * @param expected - Expected data structure (partial match)
   */
  public async assertData(expected: Record<string, any>): Promise<this> {
    const data = await this.getData();
    expect(data).toMatchObject(expected);
    return this;
  }

  /**
   * Assert that a specific field in the data equals the expected value
   * @param path - Path to the field (dot notation)
   * @param value - Expected value
   */
  public async assertDataField(path: string, value: any): Promise<this> {
    const data = await this.getData();
    const actual = this.extractFromPath(data, path);
    expect(actual).toEqual(value);
    return this;
  }

  /**
   * Assert that a specific field in the data contains the expected value
   * @param path - Path to the field (dot notation)
   * @param value - Expected value
   */
  public async assertDataFieldContains(path: string, value: any): Promise<this> {
    const data = await this.getData();
    const actual = this.extractFromPath(data, path);
    
    if (Array.isArray(actual)) {
      expect(actual).toContainEqual(value);
    } else if (typeof actual === 'string') {
      expect(actual).toContain(String(value));
    } else {
      expect(actual).toMatchObject(value);
    }
    return this;
  }

  /**
   * Assert that the response has data (not null/undefined)
   */
  public async assertHasData(): Promise<this> {
    const data = await this.getData();
    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    return this;
  }

  /**
   * Assert that a specific error code exists in the response
   * @param errorCode - Expected error code in extensions
   */
  public async assertErrorCode(errorCode: string): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeDefined();
    
    const hasErrorCode = errors!.some(error => 
      error.extensions?.code === errorCode
    );
    
    expect(hasErrorCode).toBe(true);
    return this;
  }

  /**
   * Assert that an error occurs at a specific path
   * @param path - Expected error path
   */
  public async assertErrorPath(path: string[]): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeDefined();
    
    const hasPath = errors!.some(error => 
      JSON.stringify(error.path) === JSON.stringify(path)
    );
    
    expect(hasPath).toBe(true);
    return this;
  }

  /**
   * Extract value from nested object using dot notation
   * @param obj - Object to extract from
   * @param path - Path in dot notation
   * @returns Extracted value
   */
  private extractFromPath(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr];
    }, obj);
  }

  /**
   * Get all field names from the data response
   * @returns Array of field names
   */
  public async getDataFields(): Promise<string[]> {
    const data = await this.getData();
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data);
  }

  /**
   * Assert that the data contains specific fields
   * @param fields - Expected field names
   */
  public async assertDataHasFields(fields: string[]): Promise<this> {
    const actualFields = await this.getDataFields();
    
    for (const field of fields) {
      expect(actualFields).toContain(field);
    }
    
    return this;
  }

  /**
   * Get the number of items in a list field
   * @param path - Path to the list field
   * @returns Number of items
   */
  public async getListSize(path: string): Promise<number> {
    const data = await this.getData();
    const list = this.extractFromPath(data, path);
    
    if (!Array.isArray(list)) {
      throw new Error(`Field at path "${path}" is not an array`);
    }
    
    return list.length;
  }

  /**
   * Assert that a list field has a specific size
   * @param path - Path to the list field
   * @param expectedSize - Expected number of items
   */
  public async assertListSize(path: string, expectedSize: number): Promise<this> {
    const actualSize = await this.getListSize(path);
    expect(actualSize).toBe(expectedSize);
    return this;
  }
}

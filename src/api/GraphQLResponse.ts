import { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import * as z from 'zod';
import { ApiResponseWrapper } from './ApiResponse';
import { GraphQLResponse } from './GraphQLClient';

export class GraphQLResponseWrapper extends ApiResponseWrapper {
  private graphqlResponse?: GraphQLResponse;

  public async getGraphQLResponse<T = any>(): Promise<GraphQLResponse<T>> {
    if (!this.graphqlResponse) {
      this.graphqlResponse = await this.json<GraphQLResponse<T>>();
    }
    return this.graphqlResponse as GraphQLResponse<T>;
  }

  public async getData<T = any>(): Promise<T | undefined> {
    const response = await this.getGraphQLResponse<T>();
    return response.data;
  }

  public async getErrors(): Promise<GraphQLResponse['errors']> {
    const response = await this.getGraphQLResponse();
    return response.errors;
  }

  public async hasErrors(): Promise<boolean> {
    const errors = await this.getErrors();
    return !!errors && errors.length > 0;
  }

  public async getErrorMessages(): Promise<string[]> {
    const errors = await this.getErrors();
    if (!errors) return [];
    return errors.map(error => error.message);
  }

  public async assertNoErrors(): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeUndefined();
    return this;
  }

  public async assertHasErrors(): Promise<this> {
    const hasErrors = await this.hasErrors();
    expect(hasErrors).toBe(true);
    return this;
  }

  public async assertErrorMessage(expectedMessage: string): Promise<this> {
    const messages = await this.getErrorMessages();
    const hasMessage = messages.some(msg => msg.includes(expectedMessage));
    expect(hasMessage).toBe(true);
    return this;
  }

  public async assertData(expected: Record<string, any>): Promise<this> {
    const data = await this.getData();
    expect(data).toMatchObject(expected);
    return this;
  }

  public async assertDataField(path: string, value: unknown): Promise<this> {
    const data = await this.getData();
    const actual = this.extractFromPath(data, path);
    expect(actual).toEqual(value);
    return this;
  }

  public async assertDataFieldContains(path: string, value: unknown): Promise<this> {
    const data = await this.getData();
    const actual = this.extractFromPath(data, path);

    if (Array.isArray(actual)) {
      expect(actual).toContainEqual(value);
    } else if (typeof actual === 'string') {
      expect(actual).toContain(String(value));
    } else {
      expect(actual).toMatchObject(value as Record<string, unknown>);
    }
    return this;
  }

  public async assertHasData(): Promise<this> {
    const data = await this.getData();
    expect(data).toBeDefined();
    expect(data).not.toBeNull();
    return this;
  }

  public async assertErrorCode(errorCode: string): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeDefined();
    
    const hasErrorCode = errors!.some(error => 
      error.extensions?.code === errorCode
    );
    
    expect(hasErrorCode).toBe(true);
    return this;
  }

  public async assertErrorPath(path: string[]): Promise<this> {
    const errors = await this.getErrors();
    expect(errors).toBeDefined();
    
    const hasPath = errors!.some(error => 
      JSON.stringify(error.path) === JSON.stringify(path)
    );
    
    expect(hasPath).toBe(true);
    return this;
  }

  private extractFromPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce((prev: unknown, curr: string) => {
      return prev && (prev as Record<string, unknown>)[curr];
    }, obj);
  }

  public async getDataFields(): Promise<string[]> {
    const data = await this.getData();
    if (!data || typeof data !== 'object') return [];
    return Object.keys(data);
  }

  public async assertDataHasFields(fields: string[]): Promise<this> {
    const actualFields = await this.getDataFields();
    
    for (const field of fields) {
      expect(actualFields).toContain(field);
    }
    
    return this;
  }

  public async getListSize(path: string): Promise<number> {
    const data = await this.getData();
    const list = this.extractFromPath(data, path);
    
    if (!Array.isArray(list)) {
      throw new Error(`Field at path "${path}" is not an array`);
    }
    
    return list.length;
  }

  public async assertListSize(path: string, expectedSize: number): Promise<this> {
    const actualSize = await this.getListSize(path);
    expect(actualSize).toBe(expectedSize);
    return this;
  }

  /**
   * Kept independent from assertNoErrors() — validating the data shape and
   * checking for GraphQL errors are two different checks
   */
  public async assertDataSchema<T>(schema: z.ZodType<T>): Promise<this> {
    const data = await this.getData();
    const result = schema.safeParse(data);
    if (!result.success) {
      expect(result.success, z.prettifyError(result.error)).toBe(true);
    }
    return this;
  }
}

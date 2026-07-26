import { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import * as z from 'zod';

export class ApiResponseWrapper {
  private response: APIResponse;
  private responseBody: unknown;

  constructor(response: APIResponse) {
    this.response = response;
  }

  public getOriginalResponse(): APIResponse {
    return this.response;
  }

  public statusCode(): number {
    return this.response.status();
  }

  public headers(): Record<string, string> {
    return this.response.headers();
  }

  public header(name: string): string | undefined {
    return this.response.headers()[name.toLowerCase()];
  }

  public isSuccess(): boolean {
    const status = this.response.status();
    return status >= 200 && status <= 299;
  }

  public isClientError(): boolean {
    const status = this.response.status();
    return status >= 400 && status <= 499;
  }

  public isServerError(): boolean {
    const status = this.response.status();
    return status >= 500 && status <= 599;
  }

  public async json<T = any>(): Promise<T> {
    if (!this.responseBody) {
      const contentType = this.response.headers()['content-type'] || '';
      if (!contentType.includes('application/json') && !contentType.includes('application/graphql')) {
        const text = await this.response.text();
        throw new Error(
          `Expected JSON response but got "${contentType}" (HTTP ${this.response.status()}).\n` +
          `Response body (first 500 chars): ${text.slice(0, 500)}`
        );
      }
      this.responseBody = await this.response.json();
    }
    return this.responseBody as T;
  }

  public async text(): Promise<string> {
    return await this.response.text();
  }

  public async extract<T = any>(path: string): Promise<T> {
    const body = await this.json();
    return this.extractFromObject(body, path) as T;
  }

  private extractFromObject(obj: unknown, path: string): unknown {
    return path.split('.').reduce((prev: unknown, curr: string) => {
      return prev && (prev as Record<string, unknown>)[curr];
    }, obj);
  }

  public async assertStatus(expectedStatus: number): Promise<this> {
    expect(this.response.status()).toBe(expectedStatus);
    return this;
  }

  public async assertJson(expected: Record<string, any>): Promise<this> {
    const body = await this.json();
    expect(body).toMatchObject(expected);
    return this;
  }

  public async assertJsonPath(path: string, value: unknown): Promise<this> {
    const actual = await this.extract(path);
    expect(actual).toEqual(value);
    return this;
  }

  public async assertJsonPathContains(path: string, value: unknown): Promise<this> {
    const actual = await this.extract(path);
    if (Array.isArray(actual)) {
      expect(actual).toContainEqual(value);
    } else if (typeof actual === 'string') {
      expect(actual).toContain(String(value));
    } else {
      expect(actual).toMatchObject(value as Record<string, unknown>);
    }
    return this;
  }

  public async assertHeader(name: string, value: string): Promise<this> {
    const headerValue = this.header(name);
    expect(headerValue).toBe(value);
    return this;
  }

  public async assertHasHeader(name: string): Promise<this> {
    const headerValue = this.header(name);
    expect(headerValue).toBeDefined();
    return this;
  }

  public async assertSchema<T>(schema: z.ZodType<T>): Promise<this> {
    const body = await this.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      expect(result.success, z.prettifyError(result.error)).toBe(true);
    }
    return this;
  }
}

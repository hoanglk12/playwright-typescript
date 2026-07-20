import { test } from '@playwright/test';
import { ApiClient } from './ApiClient';
import { ApiResponseWrapper } from './ApiResponse';
import { redactSensitiveData, redactSensitiveText } from '../utils/redact';

/**
 * Extended API client with response wrapper utilities
 */
export class ApiClientExt extends ApiClient {
  /**
   * Send a GET request and return wrapped response
   * @param url - URL path to request
   * @param queryParams - Query parameters to include
   * @returns API response wrapper
   */
  async getWithWrapper(url: string, queryParams?: Record<string, any>): Promise<ApiResponseWrapper> {
    const response = await this.get(url, queryParams);
    const wrapper = new ApiResponseWrapper(response);
    await this.attachVerboseLog('GET', url, { queryParams }, undefined, wrapper);
    return wrapper;
  }

  /**
   * Send a POST request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async postWithWrapper(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.post(url, data, headers);
    const wrapper = new ApiResponseWrapper(response);
    await this.attachVerboseLog('POST', url, data, headers, wrapper);
    return wrapper;
  }

  /**
   * Send a PUT request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async putWithWrapper(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.put(url, data, headers);
    const wrapper = new ApiResponseWrapper(response);
    await this.attachVerboseLog('PUT', url, data, headers, wrapper);
    return wrapper;
  }

  /**
   * Send a PATCH request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @param headers - Additional headers
   * @returns API response wrapper
   */
  async patchWithWrapper(url: string, data?: unknown, headers?: Record<string, string>): Promise<ApiResponseWrapper> {
    const response = await this.patch(url, data, headers);
    const wrapper = new ApiResponseWrapper(response);
    await this.attachVerboseLog('PATCH', url, data, headers, wrapper);
    return wrapper;
  }

  /**
   * Send a DELETE request and return wrapped response
   * @param url - URL path to request
   * @param data - Request body data
   * @returns API response wrapper
   */
  async deleteWithWrapper(url: string, data?: unknown): Promise<ApiResponseWrapper> {
    const response = await this.delete(url, data);
    const wrapper = new ApiResponseWrapper(response);
    await this.attachVerboseLog('DELETE', url, data, undefined, wrapper);
    return wrapper;
  }

  /**
   * Whether verbose (redacted) request/response body logging is enabled.
   *
   * Checked directly against `process.env` (not `getApiEnvironment()`) to avoid a
   * `dotenv.config()` / filesystem round-trip on every request — mirrors the same
   * direct-env-read pattern used by `PercyHelper` for `PERCY_TOKEN`.
   *
   * Default ON (explicit product decision, accepted risk) — set `VERBOSE_LOGS=false`
   * (or `=0`) to opt out for a run. Every `apiClientExt`/`createClientExt` call now
   * attaches a redacted request+response JSON per call by default; the redaction in
   * `src/utils/redact.ts` is the only safeguard against leaking tokens/PII into CI
   * artifacts and the public Cloudflare Pages report sites — there is no dedicated
   * regression test for it (removed; see git history for `tests/api/verbose-logging.spec.ts`).
   * Extend `SENSITIVE_KEYS`/`redactSensitiveText` in `src/utils/redact.ts` before adding
   * any new field/header that could carry a secret or PII.
   */
  private static isVerboseLoggingEnabled(): boolean {
    const flag = process.env.VERBOSE_LOGS;
    return flag !== 'false' && flag !== '0';
  }

  /**
   * Attach a redacted request+response JSON blob for this call, only when `VERBOSE_LOGS`
   * is enabled and only when running inside an active Playwright test context. Purely
   * additive instrumentation — never throws, never alters the returned wrapper.
   */
  private async attachVerboseLog(
    method: string,
    url: string,
    requestBody: unknown,
    requestHeaders: Record<string, string> | undefined,
    wrapper: ApiResponseWrapper,
  ): Promise<void> {
    if (!ApiClientExt.isVerboseLoggingEnabled()) {
      return;
    }

    try {
      let responseBody: unknown;
      try {
        const rawText = await wrapper.getOriginalResponse().text();
        responseBody = rawText ? JSON.parse(rawText) : rawText;
      } catch {
        responseBody = undefined;
      }

      // Redact the whole payload (incl. method/url — a secret can be embedded in a query
      // string or path segment with no object key to match against key-based redaction).
      const payload = redactSensitiveData({
        method,
        url,
        request: { headers: requestHeaders, body: requestBody },
        response: {
          status: wrapper.statusCode(),
          headers: wrapper.headers(),
          body: responseBody,
        },
      });

      // Second, value-level pass over the serialized text — catches secrets/PII that
      // key-based redaction can't see (e.g. a token in the `url` string itself).
      const body = redactSensitiveText(JSON.stringify(payload, null, 2));

      await test.info().attach(`api-verbose-${method}-${Date.now()}.json`, {
        body,
        contentType: 'application/json',
      });
    } catch {
      // Never let instrumentation failure affect the actual API call/assertions.
    }
  }
}

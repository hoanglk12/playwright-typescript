/**
 * Buffer-then-flush-on-failure sink for API verbose logging (Option B).
 *
 * `ApiClientExt` and `GraphQLClient` push one redacted request/response entry per call here
 * instead of attaching immediately. A single teardown fixture (`attachVerboseLogFailureContext`
 * in `ApiTest.ts`) flushes the buffered entries for a test into one attachment, and only when
 * that test failed — passing tests never get an attachment, keeping monocart's `index.json`
 * bounded by failing-test count rather than total call count. Mirrors the
 * `TestLogger.registry`/`consumeBuffer` pattern in `test-logger.ts`.
 */

export interface VerboseLogEntry {
  [key: string]: unknown;
}

const registry: Map<string, VerboseLogEntry[]> = new Map();

/**
 * Buffer one redacted request/response entry against the currently running test's testId.
 * @param testId - `testInfo.testId` of the currently running test
 * @param entry - Already key-redacted (via `redactSensitiveData`) request/response payload
 */
export function bufferVerboseLog(testId: string, entry: VerboseLogEntry): void {
  const existing = registry.get(testId);
  if (existing) {
    existing.push(entry);
  } else {
    registry.set(testId, [entry]);
  }
}

/**
 * Remove and return all buffered entries for a given testId. Called once by the per-test
 * attach fixture; clearing avoids stale content leaking into retries.
 * @param testId - `testInfo.testId` of the test to flush
 * @returns Buffered entries in call order, or `undefined` if none were buffered
 */
export function consumeVerboseLogBuffer(testId: string): VerboseLogEntry[] | undefined {
  const entries = registry.get(testId);
  registry.delete(testId);
  return entries;
}

---
description: Scaffold a new API test file (REST or GraphQL) with all framework boilerplate
---

Create a new API test file for: $ARGUMENTS

Before writing anything, ask exactly one question if not already clear from $ARGUMENTS: "Is this a REST test, a GraphQL test, or does it cover both?"

Then create the file following these non-negotiable rules:

**File location:** tests/api/

**Import block — CRITICAL (wrong imports break fixture resolution):**
```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { AuthType } from '../../src/api/ApiClient';  // only if custom auth needed
import { createTestLogger } from '../../src/utils/test-logger';
import { MyData } from '../../src/data/my-data';  // create this module
```
NEVER use `@config/base-test` or `@playwright/test` in files under tests/api/.

**Serial mode — depends on spec type:**
- **GRA spec files (`gra-*.spec.ts`)** — do NOT add `test.describe.configure({ mode: 'serial' })`. Sequential execution is already guaranteed by `fullyParallel: false` in `api.config.ts`; serial mode causes cascade-skips on failure that hide test signal.
- **Non-GRA specs** (e.g. `restful-booker.spec.ts`, `objects-crud.spec.ts`) — may add it as the first statement outside imports:
```ts
test.describe.configure({ mode: 'serial' });
```

**Test structure:**
- Tags in `test.describe()` name string: `@api @regression` or `@api @graphql`
- Test names: `TC_XX - Description` format
- `createTestLogger('TC_XX description')` at start of every test
- `logger.step()` before each logical step
- `logger.verify()` before assertions
- `logger.action()` for HTTP calls

**REST tests — use ApiClientExt for automatic chaining:**
```ts
const response = await apiClientExt.getWithWrapper('/endpoint');
await response.assertStatus(200);
await response.assertJsonPath('field', expectedValue);
await response.assertJsonPathContains('tags', 'active');
```

**GraphQL tests — assertNoErrors() is ALWAYS the first assertion:**
```ts
const response = await graphqlClient.queryWrapped(
  `query Op($id: ID!) { resource(id: $id) { id name } }`,
  { id: variableValue }  // NEVER string-interpolate variables into the query
);
await response.assertNoErrors();  // REQUIRED before any data assertion
await response.assertDataField('resource.id', variableValue);
```

**Test data — no inline data in spec files:**
Check for an existing module first via `mcp__codebase-memory-mcp__search_graph` (query: the resource/feature name, file_pattern: `src/data/api/*`; project: this repo — run `list_projects` if the exact key is unknown). Fall back to `Grep`/`Glob` on `src/data/api/` if the tool is unavailable. If none fit, create `src/data/{kebab-name}-data.ts` with:
- Named interface for every data shape
- `const MyData: MyDataShape = { ... }` annotation (never inferred types)
- `class MyDataGenerator { static generate(): MyShape { ... } }` for dynamic data

**Fixture selection guide:**
- Raw HTTP + assertion chaining → `apiClientExt`
- Service abstraction → `bookingService` or `restfulApiClient`
- GraphQL → `graphqlClient`
- Custom auth in one test → `createGraphQLClient({ authType: AuthType.BEARER, token })`

Create the complete test file and the data module. Run `npm run lint` to verify TypeScript compiles.

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

**Serial mode — first statement outside imports:**
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
Create `src/data/{kebab-name}-data.ts` with:
- Named interface for every data shape
- `const MyData: MyDataShape = { ... }` annotation (never inferred types)
- `class MyDataGenerator { static generate(): MyShape { ... } }` for dynamic data

**Fixture selection guide:**
- Raw HTTP + assertion chaining → `apiClientExt`
- Service abstraction → `bookingService` or `restfulApiClient`
- GraphQL → `graphqlClient`
- Custom auth in one test → `createGraphQLClient({ authType: AuthType.BEARER, token })`

Create the complete test file and the data module. Run `npm run lint` to verify TypeScript compiles.

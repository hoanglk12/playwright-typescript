---
description: Scaffold a new API test file (REST or GraphQL) with all framework boilerplate
---

Create a new API test file. Before writing anything, ask exactly one question if not already clear: "Is this a REST test, a GraphQL test, or does it cover both?"

**File location:** `tests/api/`

**Import block — CRITICAL:**
```ts
import { apiTest as test, expect } from '../../src/api/ApiTest';
import { AuthType } from '../../src/api/ApiClient';  // only if custom auth needed
import { createTestLogger } from '../../src/utils/test-logger';
import { MyData } from '../../src/data/my-data';
```
NEVER use `@config/base-test` or `@playwright/test` in files under `tests/api/`.

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

**REST tests:**
```ts
const response = await apiClientExt.getWithWrapper('/endpoint');
await response.assertStatus(200);
await response.assertJsonPath('field', expectedValue);
```

**GraphQL tests — assertNoErrors() is ALWAYS first:**
```ts
const response = await graphqlClient.queryWrapped(
  `query Op($id: ID!) { resource(id: $id) { id name } }`,
  { id: variableValue }  // NEVER string-interpolate variables
);
await response.assertNoErrors();
await response.assertDataField('resource.id', variableValue);
```

**Test data — no inline data in spec files:**
Create `src/data/{kebab-name}-data.ts` with named interfaces and typed const objects.

After creating the file, run `npm run lint` to verify TypeScript compiles.

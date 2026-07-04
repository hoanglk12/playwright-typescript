---
description: Scaffold a new UI test spec (frontsite/admin/ecommerce) with all framework boilerplate
---

Create a new UI test spec. Identify the area (frontsite, admin, or ecommerce). If unclear, ask before creating anything.

**File location:** `tests/{area}/`

**Import block — CRITICAL:**
```ts
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { MyData } from '../../src/data/my-data';
// For soft assertions:
import { test, expect, softExpect } from '@config/base-test';
```
NEVER import from `@playwright/test` directly — this loses all custom fixtures.

**Test structure rules:**
- Tags in `test.describe()` name string: `'Feature Name @smoke @regression'`
- Test names follow `TC_XX - Description` format
- `createTestLogger('TC_XX description')` at start of every test body
- `logger.step('Step N - description')` before each logical step
- `logger.verify('what is checked', expected, actual)` before hard assertions
- Do NOT call `logger.verify()` before `softAssert.*` — softAssert logs internally

**Assertion decision:**
| Situation | Use |
|---|---|
| Multiple independent checks | `softAssert` fixture |
| Precondition guarding next step | hard `expect()` |
| Playwright locator assertions | hard `expect(locator).*` |
| Single assertion in the test | hard `expect()` |

**Test data — no hardcoded strings in spec files:**
Check `src/data/` for existing modules first. If none fit, create `src/data/{kebab-name}-data.ts`:
- Declare named interfaces first
- Annotate const: `export const MyData: MyDataShape = { ... }`

**Fixtures:** Check `src/config/base-test.ts` for registered fixtures before creating new page objects. If you need a new page object, use the `new-page-object` workflow.

Run `npm run lint` to verify TypeScript compiles.

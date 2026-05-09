---
description: Scaffold a new UI test spec (frontsite/admin/ecommerce) with all framework boilerplate
---

Create a new UI test spec for: $ARGUMENTS

Identify the area (frontsite, admin, or ecommerce) from the description. If unclear, ask before creating anything.

**File location:** tests/{area}/

**Import block — CRITICAL:**
```ts
import { test, expect } from '@config/base-test';
import { createTestLogger } from '../../src/utils/test-logger';
import { MyData } from '../../src/data/my-data';
// For soft assertions:
import { test, expect, softExpect } from '@config/base-test';
```
NEVER import from `@playwright/test` directly in test files — this loses all custom fixtures.

**Test structure rules:**
- Tags go in `test.describe()` name string, NOT in `test()` names: `'Feature Name @smoke @regression'`
- Test names follow `TC_XX - Description` format
- `createTestLogger('TC_XX description')` at the start of every test body
- `logger.step('Step N - description')` before each logical step
- `logger.verify('what is being checked', expected, actual)` before hard assertions
- `logger.action('Click', 'element name')` for user interactions

**Assertion decision — apply every time:**
| Situation | Use |
|---|---|
| Multiple independent checks (title, count, label, visibility) | `softAssert` fixture via `{ myPage, softAssert }` |
| Per-item check in a loop (each item has label AND href) | `softAssert` |
| Precondition that guards the next step | hard `expect()` — stop if this fails |
| Playwright locator assertions (`toHaveCSS`, `toContainText`, `toBeInViewport`) | hard `expect(locator).*` |
| `expect.poll()` | keep hard |
| Single assertion in the test | hard `expect()` |

Do NOT call `logger.verify()` before `softAssert.*` — softAssert logs internally with 🔵 [SOFT].

**Test data — no hardcoded strings in spec files:**
Check `src/data/` for existing data modules first. If none fit, create `src/data/{kebab-name}-data.ts`:
- Declare named interfaces first
- Annotate const objects: `export const MyData: MyDataShape = { ... }`
- Generator methods: `static generate(): MyShape { return { ... }; }`

**Fixtures — use existing page objects:**
Check `src/config/base-test.ts` for currently registered fixtures before creating new page objects. If you need a new page object, use `/new-page-object` instead.

Create the spec file and any needed data modules. Run `npm run lint` to verify TypeScript.

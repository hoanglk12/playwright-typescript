---
description: Scaffold a new page object following the composition-based POM with BasePage helpers
---

Create a new page object. Identify the class name and area (frontsite, admin, or ecommerce). Check `src/pages/{area}/` first — if a page object for this page already exists, extend or update it rather than creating a duplicate.

**File location:** `src/pages/{area}/{kebab-name}.ts`

**Class template:**
```ts
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class MyFeaturePage extends BasePage {
  // ALL locators here — NEVER inline inside methods
  private readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
  private readonly emailInput = this.page.getByLabel('Email address');
  // CSS selectors only for style checks or evaluate():
  private readonly headingSelector = 'h1.page-title';

  constructor(page: Page) { super(page); }

  async clickSubmit(): Promise<void> {
    await this.elements.clickElement(this.submitBtn);
  }

  async fillEmail(email: string): Promise<void> {
    await this.elements.fillInput(this.emailInput, email);
  }
}
```

**Non-negotiable locator rules:**
- `private readonly` class fields at the **top** of the class — never inline inside method bodies
- Prefer `getByRole()` → `getByLabel()` → `getByText()` → `getByPlaceholder()` over CSS
- CSS selectors **only** for `this.style.*` or `page.evaluate()` calls

**Helper usage — NEVER call `page.*` directly:**
| Operation | Helper |
|---|---|
| Click, fill, getText, isVisible | `this.elements.*` |
| Wait for page/element/network | `this.waits.*` |
| Computed CSS, colour | `this.style.*` |
| iframe content | `this.frames.*` |
| File upload | `this.files.*` |
| Cookies, localStorage | `this.storage.*` |
| Route mocking | `this.network.*` |
| HTML table rows/cells | `this.tables.*` |

**After creating the class, register it as a fixture in `src/config/base-test.ts`:**
```ts
// Add to CustomFixtures type:
myFeaturePage: MyFeaturePage;

// Add to test.extend:
myFeaturePage: async ({ page }, use) => {
  await use(new MyFeaturePage(page));
},
```

Run `npm run lint` to verify TypeScript compiles without errors.

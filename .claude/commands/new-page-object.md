---
description: Scaffold a new page object following the composition-based POM with BasePage helpers
---

Create a new page object for: $ARGUMENTS

Identify the class name and area (frontsite, admin, or ecommerce) from the description. Check `src/pages/{area}/` first — if a page object for this page already exists, extend or update it rather than creating a duplicate.

**File location:** src/pages/{area}/{kebab-name}.ts

**Class template:**
```ts
import { Page } from '@playwright/test';
import { BasePage } from '../base-page';

export class MyFeaturePage extends BasePage {
  // ALL locators here — NEVER inline inside methods
  private readonly submitBtn = this.page.getByRole('button', { name: 'Submit' });
  private readonly emailInput = this.page.getByLabel('Email address');
  private readonly resultItems = this.page.getByRole('listitem');
  // CSS selectors only for style checks or evaluate():
  private readonly headingSelector = 'h1.page-title';

  constructor(page: Page) {
    super(page);
  }

  async navigateTo(): Promise<void> {
    await this.waits.waitForPageLoad();
  }

  async clickSubmit(): Promise<void> {
    await this.elements.clickElement(this.submitBtn);
  }

  async fillEmail(email: string): Promise<void> {
    await this.elements.fillInput(this.emailInput, email);
  }

  async isSubmitVisible(): Promise<boolean> {
    return this.elements.isElementVisible(this.submitBtn);
  }
}
```

**Non-negotiable locator rules:**
- `private readonly` class fields at the **top** of the class — never inline inside method bodies, `page.evaluate()` literals, or helper call arguments
- Prefer `getByRole()` → `getByLabel()` → `getByText()` → `getByPlaceholder()` over CSS
- CSS selectors **only** for `this.style.*` computed-style queries or `page.evaluate()` calls

**Helper usage — NEVER call `page.*` directly in page methods:**
| Operation | Helper |
|---|---|
| Click, fill, getText, isVisible, scroll | `this.elements.*` |
| Wait for page/element/network/condition | `this.waits.*` |
| Computed CSS, colour, dimensions | `this.style.*` |
| iframe content | `this.frames.*` |
| File upload, drag-drop | `this.files.*` |
| Cookies, localStorage, sessionStorage | `this.storage.*` |
| Route mocking, request intercept | `this.network.*` |
| HTML table rows/cells | `this.tables.*` |

**Method naming:** describe user actions, not DOM implementation (`clickSubmit` not `clickButtonId42`).

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

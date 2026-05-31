---
name: Project Architecture
description: Core architectural decisions — composition helpers, fixture system, dual configs, import rules
metadata:
  type: project
---

Playwright TypeScript framework. Key facts:

- **Composition not inheritance**: `BasePage` delegates to 8 helper instances (`this.waits`, `this.elements`, `this.style`, `this.frames`, `this.files`, `this.storage`, `this.network`, `this.tables`). `PercyHelper` is **not** a BasePage field — it is available only as the `percyHelper` fixture in tests. New browser interactions go in the helpers, not `BasePage` directly.
- **Import rule**: Always `import { test, expect } from '@config/base-test'` in test files — never `@playwright/test` directly. The base-test extends with all page fixtures.
- **Two configs**: `playwright.config.ts` (UI, all tests except `**/api/**`) and `api.config.ts` (API only, 1 worker serial).
- **Firefox teardown**: `ecommerceHomePage` fixture navigates to `about:blank` before teardown on Firefox — intentional workaround for Juggler/service-worker hang. Do not remove.
- **Multi-app**: frontSiteUrl (Accent Group frontsite), adminUrl (guru99 bank), apiBaseUrl (restful-booker).
- **Test data**: All test data in `src/data/`, never hardcoded in spec files. Static = const objects; dynamic = generators.
- **Global lifecycle**: Setup validates env + browser installs + connectivity. Teardown archives artifacts in CI.

**Why:** Framework migrated from Maven Selenium hybrid. Composition pattern chosen to avoid fragile deep inheritance chains.

**How to apply:** When adding features, check which helper class owns the behaviour before touching BasePage. When writing tests, always verify the fixture is registered in base-test.ts.

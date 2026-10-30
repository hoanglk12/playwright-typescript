# Proving a step can be automated

Use this when the user asks whether a step can really be automated, or after changing a page object so a check works on mobile. It's how TEST-878 step 3 was proven: the Qantas check only read `.top-header-desktop`, the fix added `.top-header-mobile`, and the runs below showed the fix worked and was the reason.

There's no mobile project in `playwright.config.ts`, so a proof run needs a temporary config. Adding a permanent mobile project is a framework change: raise it with the user, don't make it as part of a proof.

## 1. Temporary config

Create `playwright.mobile-proof.config.ts` at the repo root:

```ts
import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

const { defaultBrowserType: _webkit, ...iphone15 } = devices['iPhone 15'];

export default defineConfig({
  ...base,
  globalSetup: undefined,
  globalTeardown: undefined,
  reporter: [['list']],
  outputDir: '<scratchpad>/proof-results',
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-15-chromium', use: { ...iphone15, browserName: 'chromium' } },
  ],
});
```

It skips global setup and teardown because they wipe `test-results/` and the logs, and it writes results to the scratchpad so the user's reports stay untouched.

## 2. Runs

| Run | Command | What it shows |
|---|---|---|
| Both views, all 8 sites | `npx playwright test --config=playwright.mobile-proof.config.ts <spec> --grep "<scenario IDs>"` | The check works on mobile and still works on desktop |
| Mobile, repeated | add `--project=iphone-15-chromium --repeat-each=3` | It's stable, not a one-off pass |
| Control (only if code changed) | copy the fixed file to the scratchpad, restore the old line, run 2 sites on mobile, then copy the fix back | The change is what makes it pass. Expect a failure here |

Run the first one in the background. 48 tests took about a minute for E2E-HOME-001 to 003.

## 3. Clean up and report

1. Delete `playwright.mobile-proof.config.ts`. Never commit it.
2. Run `npm run lint`.
3. Check `git diff` shows only the intended change.
4. Report a table of run, what it shows and the result, plus what the proof doesn't cover: WebKit wasn't run, and mobile still won't run in normal runs.

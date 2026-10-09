// GRA-XXXX — <Xray test summary>
// Steps source: <ticket description | ManualTest/Tasks/<sprint>/<file>.json TC-NN | Xray step grid>
//
// How it works
//   1. <What it sets up before any page opens, e.g. holds every <Op> call for 5s and logs traffic.>
//   2. Signs in and opens <page>. If that fails it still pauses, so you can sign in by hand.
//   3. Pauses. <What you do and check by hand>, then click Resume in the Playwright Inspector.
//   4. On Resume it prints and attaches the timeline, then checks: <each automated check>.
//
// To run it (PowerShell)
//   npx playwright test --config=manual.config.ts tests/manual/gra-xxxx-<slug>.spec.ts
//
// Optional env (clear afterwards with Remove-Item Env:<name>)
//   GRAXXXX_SITE  storefront name, default 'Platypus AU'
//   GRAXXXX_OP    operationName to intercept, default '<OperationName>'
//
// Copy this file to tests/manual/gra-xxxx-<slug>.spec.ts, replace every placeholder and delete what
// the case does not need. Rules: tests/manual/CLAUDE.md.
import * as fs from 'fs';
import { test, expect } from '@config/base-test';
import type { Request, Route } from '@playwright/test';
import { storefronts } from '@data/ecommerce/storefronts';
import { testAccounts } from '@data/ecommerce/test-accounts';
import { createTestLogger } from '@utils/test-logger';

type Simulation = 'hold' | 'graphql-error' | 'http-500' | 'abort';

const TARGET_OP = process.env.GRAXXXX_OP ?? '<OperationName>';
const SIMULATION: Simulation = 'hold';
const HOLD_MS = 5000;
const SITE_NAME = process.env.GRAXXXX_SITE ?? 'Platypus AU';

interface TargetCall {
  requestedAt: number;
  respondedAt?: number;
  status?: number;
  hasErrors?: boolean;
}

function operationNames(request: Request): string[] {
  const fromUrl = new URL(request.url()).searchParams.get('operationName');
  if (fromUrl) return [fromUrl];
  try {
    const body: unknown = request.postDataJSON();
    const ops = Array.isArray(body) ? body : [body];
    return ops
      .map((op) => (op as { operationName?: string } | null)?.operationName)
      .filter((name): name is string => typeof name === 'string');
  } catch {
    return [];
  }
}

async function simulate(route: Route): Promise<void> {
  switch (SIMULATION) {
    case 'hold':
      await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
      return route.continue();
    case 'graphql-error':
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'Simulated failure', extensions: { category: 'graphql' } }] }),
      });
    case 'http-500':
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'Simulated server error' });
    case 'abort':
      return route.abort('failed');
  }
}

test.describe('GRA-XXXX <short title> @manual', () => {
  test('GRA-XXXX - <Xray test summary>', async ({
    page,
    ecommerceAccountModalPage,
    ecommerceMyDetailsPage,
    softAssert,
  }, testInfo) => {
    const logger = createTestLogger('GRA-XXXX');

    const site = storefronts.find((s) => s.name === SITE_NAME);
    expect(site, `Unknown GRAXXXX_SITE "${SITE_NAME}"`).toBeDefined();
    if (!site) return;
    const email = testAccounts[site.name]?.email ?? '';
    const password = testAccounts[site.name]?.password ?? '';
    test.skip(!email || !password, 'No account email, or GRA_TEST_PASSWORD is not set — leave NODE_ENV unset or set it to testing');

    const t0 = Date.now();
    const elapsed = (): number => Date.now() - t0;
    const timeline: string[] = [];
    const mark = (event: string): void => {
      timeline.push(`${String(elapsed()).padStart(7)}ms  ${event}`);
    };
    const targetCalls = new Map<Request, TargetCall>();
    const pendingBodyReads: Promise<void>[] = [];
    let simulationsApplied = 0;

    logger.step('Step 1 - Register the simulation and the timeline before any navigation');
    await page.route('**/graphql**', async (route) => {
      if (!operationNames(route.request()).includes(TARGET_OP)) return route.fallback();
      simulationsApplied++;
      mark(`SIMULATION APPLIED ${SIMULATION} ${TARGET_OP}`);
      return simulate(route);
    });

    page.on('request', (request) => {
      if (!request.url().includes('/graphql') || request.method() !== 'POST') return;
      const ops = operationNames(request);
      mark(`REQ  POST graphql op=${ops.join('+') || '?'}`);
      if (ops.includes(TARGET_OP)) targetCalls.set(request, { requestedAt: elapsed() });
    });

    page.on('response', (response) => {
      const call = targetCalls.get(response.request());
      if (!call) return;
      call.respondedAt = elapsed();
      call.status = response.status();
      pendingBodyReads.push(
        response
          .json()
          .then((body: { errors?: unknown[] }) => {
            call.hasErrors = Array.isArray(body?.errors) && body.errors.length > 0;
          })
          .catch(() => {
            call.hasErrors = true;
          })
          .finally(() => mark(`RES  ${call.status} ${TARGET_OP} errors=${call.hasErrors}`)),
      );
    });

    logger.step(`Step 2 - Sign in on ${site.name} and open the starting page`);
    try {
      await ecommerceAccountModalPage.navigate(site.url);
      await ecommerceAccountModalPage.openModal();
      await ecommerceAccountModalPage.waitForModalVisible();
      await ecommerceAccountModalPage.login(email, password);
      await ecommerceAccountModalPage.waitForLoginComplete();
      mark(`signed in = ${await ecommerceAccountModalPage.isLoggedIn()}`);
      await ecommerceMyDetailsPage.navigateToMyDetails(site.url);
      mark('opened starting page');
    } catch (error) {
      mark(`automatic sign-in/navigation failed — continue by hand: ${String(error).split('\n')[0]}`);
    }

    logger.step('Step 3 - Paused for the manual steps');
    console.log(['', 'GRA-XXXX', '  1. <manual step>', '  2. Click Resume in the Playwright Inspector.', ''].join('\n'));
    await page.pause();

    logger.step('Step 4 - Print the timeline and run the checks');
    await Promise.all(pendingBodyReads);
    const report = timeline.join('\n');
    // A body attachment never reaches disk; writing the file gives the tester something to attach to Xray.
    const timelinePath = testInfo.outputPath('gra-xxxx-timeline.txt');
    fs.writeFileSync(timelinePath, report);
    await testInfo.attach('gra-xxxx-timeline.txt', { path: timelinePath, contentType: 'text/plain' });
    console.log(`\nGRA-XXXX timeline (${site.name}) — saved to ${timelinePath}\n${report}\n`);

    expect(
      simulationsApplied,
      `the ${SIMULATION} simulation never fired — check the op names in the timeline, or set GRAXXXX_OP`,
    ).toBeGreaterThan(0);
    softAssert.toBeGreaterThan(targetCalls.size, 0, `${TARGET_OP} was sent`);
  });
});

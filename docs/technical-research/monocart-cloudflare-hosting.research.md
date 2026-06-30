# Technical Research Report — Hosting monocart Reports on Cloudflare Pages

**Date:** 2026-05-10
**Author:** technical-research-agent
**Status:** Research complete — awaiting user approval before implementation
**Approval gate:** Required before `technical-implementation-agent` runs

---

## 1. Context

**Problem:** Slack "UI Report" / "API Report" / "Download Report" buttons resolve to GitHub artifact download URLs. Recipients must be authenticated to GitHub, download a zip, extract it, and open `index.html` locally. This is friction for non-developer stakeholders.

**Goal:** Three stable, publicly accessible URLs that open the interactive monocart report in a browser with a single click — no GitHub login, no download.

**User requirements:** Free plan. One URL for UI reports, one URL for API reports.

**Why Cloudflare Pages over Netlify:** The previous Netlify research found that new Netlify accounts use credit-based pricing (300 credits/month free). At 1 push/day × 2 deploys = 900 credits/month — 3× over the free cap. Cloudflare Pages free tier has **unlimited bandwidth** and **500 builds/month**, which comfortably covers this project's CI cadence.

---

## 2. Scope — Files to Change

### Workflow files (the only changes needed)

| File | Change |
|---|---|
| `.github/workflows/playwright-with-slack.yml` | Add 2 Cloudflare Pages deploy steps in `test-report` job. Add 2 outputs (`ui_deploy_url`, `api_deploy_url`). Update Slack button URLs. |
| `.github/workflows/api-restful-tests-with-slack.yml` | Add 1 Cloudflare Pages deploy step in `api-tests` job. Add `api_deploy_url` output. Update "Download Report" button URL. |

### Files NOT changed

`playwright.config.ts`, `api.config.ts`, `package.json`, `tsconfig.json`, `src/config/base-test.ts`, all page objects, all helpers, all test specs, `Dockerfile`, Percy scripts, Lighthouse config.

### New GitHub Actions secrets required

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → use "Edit Cloudflare Workers" template, replace permissions with `Account \| Cloudflare Pages \| Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID shown in right panel, or from URL: `dash.cloudflare.com/<account-id>` |

---

## 3. Options Compared

### Option A — Cloudflare Pages (recommended)

**URL pattern:** `https://playwright-ui-reports.pages.dev` and `https://playwright-api-reports.pages.dev`
**Deploy tool:** `npx wrangler@3 pages deploy <dir> --project-name <name> --branch main`
**URL type:** "Always latest" — each deploy overwrites the production URL
**Free limits:** Unlimited bandwidth, 500 builds/month per account

Pros:
- Truly unlimited bandwidth (no credit cap)
- 500 builds/month free (generous for active repos)
- Official Cloudflare CLI (`wrangler`) — no third-party GitHub Actions
- Stable predictable URL known before the deploy runs (hardcode it)
- No commercial use restrictions

Cons:
- No per-run URLs: Slack buttons from old runs all point to the same (latest) report
- `--branch main` required to get the stable production URL; omitting it gives only a hash-based preview URL

### Option B — Netlify (not recommended for free plan)

New accounts use credit-based pricing: 300 credits/month free. 1 push/day × 2 deploys = 900 credits/month — 3× over cap. Viable only for legacy accounts (created before Sep 2025). Supports per-run `--alias` URLs if needed later.

### Option C — GitHub Pages (not viable for two separate report URLs)

GitHub Pages allows one site per repo. Getting two independent URLs requires two separate repos or complex subpath routing. Not practical.

---

## 4. Recommended Approach

**Three Cloudflare Pages projects + Wrangler CLI + "always latest" stable URL + keep GitHub artifacts as fallback.**

Three sites with separate ownership per workflow:
- `playwright-ui-reports` → `playwright-ui-reports.pages.dev` (UI merged report, from `playwright-with-slack.yml`)
- `playwright-api-reports` → `playwright-api-reports.pages.dev` (combined workflow API report, from `playwright-with-slack.yml`)
- `playwright-restful-api-reports` → `playwright-restful-api-reports.pages.dev` (restful-only API report, from `api-restful-tests-with-slack.yml`)

Each workflow owns its own set of sites — no cross-workflow overwrites.

---

## 5. Detailed Implementation Steps

### Phase 1 — One-time Cloudflare Setup (manual, ~10 minutes)

**Step 1 — Create Cloudflare API Token**

1. Go to `dash.cloudflare.com` and log in with your existing account.
2. Click your profile icon (top right) → **My Profile** → **API Tokens** tab.
3. Click **Create Token**.
4. Use the **"Edit Cloudflare Workers"** template as a starting point.
5. Under **Permissions**, remove the Workers-specific permissions and add:
   - `Account` | `Cloudflare Pages` | `Edit`
6. Under **Account Resources**, select your account.
7. Under **Zone Resources**, set to **All zones** (Pages doesn't need zones, but this avoids scope errors).
8. Click **Continue to summary** → **Create Token**.
9. **Copy the token immediately** — it will not be shown again.

**Step 2 — Find your Cloudflare Account ID**

1. In the Cloudflare dashboard, click **Workers & Pages** in the left sidebar.
2. The Account ID is shown in the right-hand panel under "Account details".
3. Alternatively, read it from the URL: `dash.cloudflare.com/<ACCOUNT_ID>/workers-and-pages`.

**Step 3 — Create the three Pages projects (Direct Upload, no Git)**

Option A — via dashboard (no CLI required):
1. Go to **Workers & Pages** → **Create** → **Pages** tab → **Upload assets** (Direct Upload).
2. Name the project: `playwright-ui-reports`. Upload any placeholder `index.html` when prompted. Click **Deploy site**.
3. Repeat: name `playwright-api-reports`. Same placeholder. Deploy.
4. Repeat: name `playwright-restful-api-reports`. Same placeholder. Deploy.

Option B — via Wrangler CLI (requires Node.js locally with env vars set):
```bash
CLOUDFLARE_API_TOKEN=<your-token> CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  npx wrangler@3 pages project create playwright-ui-reports --production-branch main

CLOUDFLARE_API_TOKEN=<your-token> CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  npx wrangler@3 pages project create playwright-api-reports --production-branch main

CLOUDFLARE_API_TOKEN=<your-token> CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  npx wrangler@3 pages project create playwright-restful-api-reports --production-branch main
```

**Step 4 — Add GitHub Actions secrets**

In your GitHub repo: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Add two secrets:
- Name: `CLOUDFLARE_API_TOKEN` / Value: the token from Step 1
- Name: `CLOUDFLARE_ACCOUNT_ID` / Value: the account ID from Step 2

---

### Phase 2 — Changes to `playwright-with-slack.yml`

**File:** `.github/workflows/playwright-with-slack.yml`

#### Change 1: Add two job outputs (after line 257)

The current `outputs` block ends at line 257 with `api_artifact_url`. Extend it with two new entries:

```yaml
      ui_deploy_url:   ${{ steps.cf-ui.outputs.url }}
      api_deploy_url:  ${{ steps.cf-api.outputs.url }}
```

Full updated outputs block (lines 244–261):

```yaml
    outputs:
      ui_tests:         ${{ steps.monocart-ui.outputs.tests }}
      ui_passed:        ${{ steps.monocart-ui.outputs.passed }}
      ui_failed:        ${{ steps.monocart-ui.outputs.failed }}
      ui_skipped:       ${{ steps.monocart-ui.outputs.skipped }}
      ui_flaky:         ${{ steps.monocart-ui.outputs.flaky }}
      ui_duration:      ${{ steps.monocart-ui.outputs.duration }}
      api_tests:        ${{ steps.monocart-api.outputs.tests }}
      api_passed:       ${{ steps.monocart-api.outputs.passed }}
      api_failed:       ${{ steps.monocart-api.outputs.failed }}
      api_skipped:      ${{ steps.monocart-api.outputs.skipped }}
      api_duration:     ${{ steps.monocart-api.outputs.duration }}
      ui_artifact_url:  ${{ steps.ui-artifact-url.outputs.url }}
      api_artifact_url: ${{ steps.api-artifact-url.outputs.url }}
      ui_deploy_url:    ${{ steps.cf-ui.outputs.url }}
      api_deploy_url:   ${{ steps.cf-api.outputs.url }}
```

#### Change 2: Add two deploy steps after "Upload API monocart report" (after line 394)

Insert these two steps immediately after the existing `Upload API monocart report` step:

```yaml
      - name: Deploy UI monocart report to Cloudflare Pages
        if: always() && needs.ui-test.result != 'skipped' && hashFiles('monocart-merged-ui/index.html') != ''
        id: cf-ui
        run: |
          npx wrangler@3 pages deploy monocart-merged-ui \
            --project-name playwright-ui-reports \
            --branch main \
            --commit-message "UI run ${{ github.run_id }} attempt ${{ github.run_attempt }}"
          echo "url=https://playwright-ui-reports.pages.dev" >> $GITHUB_OUTPUT
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy API monocart report to Cloudflare Pages
        if: always() && needs.api-test.result != 'skipped' && hashFiles('combined-results/api/monocart-api-report/index.html') != ''
        id: cf-api
        run: |
          npx wrangler@3 pages deploy combined-results/api/monocart-api-report \
            --project-name playwright-api-reports \
            --branch main \
            --commit-message "API run ${{ github.run_id }} attempt ${{ github.run_attempt }}"
          echo "url=https://playwright-api-reports.pages.dev" >> $GITHUB_OUTPUT
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

#### Change 3: Update Slack button URLs (lines 628 and 636)

**UI Report button (line 628)** — replace the existing `url` value with a triple-fallback:

Before:
```yaml
"url": "${{ needs.test-report.outputs.ui_artifact_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```
After:
```yaml
"url": "${{ needs.test-report.outputs.ui_deploy_url || needs.test-report.outputs.ui_artifact_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```

**API Report button (line 636)** — same pattern:

Before:
```yaml
"url": "${{ needs.test-report.outputs.api_artifact_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```
After:
```yaml
"url": "${{ needs.test-report.outputs.api_deploy_url || needs.test-report.outputs.api_artifact_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```

Fallback chain: Cloudflare Pages URL → GitHub artifact URL → workflow run URL. Slack always has a valid, clickable link.

---

### Phase 3 — Changes to `api-restful-tests-with-slack.yml`

**File:** `.github/workflows/api-restful-tests-with-slack.yml`

#### Change 1: Add `api_deploy_url` output to `api-tests` job (after line 35)

Current outputs block (lines 31–35):
```yaml
    outputs:
      tests:   ${{ steps.monocart.outputs.tests }}
      passed:  ${{ steps.monocart.outputs.passed }}
      failed:  ${{ steps.monocart.outputs.failed }}
      skipped: ${{ steps.monocart.outputs.skipped }}
```

Extended (add one line):
```yaml
    outputs:
      tests:          ${{ steps.monocart.outputs.tests }}
      passed:         ${{ steps.monocart.outputs.passed }}
      failed:         ${{ steps.monocart.outputs.failed }}
      skipped:        ${{ steps.monocart.outputs.skipped }}
      api_deploy_url: ${{ steps.cf-api.outputs.url }}
```

#### Change 2: Add deploy step after "Upload monocart API report" (after line 124)

Note: uses `playwright-restful-api-reports` — its own dedicated site, separate from `playwright-api-reports` used by the combined workflow.

```yaml
    - name: Deploy monocart API report to Cloudflare Pages
      if: always()
      id: cf-api
      run: |
        npx wrangler@3 pages deploy monocart-api-report \
          --project-name playwright-restful-api-reports \
          --branch main \
          --commit-message "RESTful API run ${{ github.run_id }} attempt ${{ github.run_attempt }}"
        echo "url=https://playwright-restful-api-reports.pages.dev" >> $GITHUB_OUTPUT
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

#### Change 3: Update "Download Report" button (line 251)

Button text: rename from `"Download Report"` to `"RESTful API Report"` for clarity.

Button URL — before:
```yaml
"url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```
After:
```yaml
"url": "${{ needs.api-tests.outputs.api_deploy_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```

---

## 6. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Wrangler fails if Pages project doesn't exist | High | Medium | Pre-create all 3 projects in Phase 1 Step 3 **before** merging the workflow PR |
| `monocart-merged-ui/` empty when UI tests are skipped | Low | Medium | `hashFiles('monocart-merged-ui/index.html') != ''` guard on the deploy step |
| `combined-results/api/monocart-api-report/` empty when API tests skipped | Low | Medium | `hashFiles('combined-results/api/monocart-api-report/index.html') != ''` guard |
| Wrangler CLI version drift | Medium | Low | Pin `wrangler@3`; revisit quarterly |
| API token compromised | High | Low | Token scoped to Pages:Edit only; rotate quarterly; add to repo secrets, not org secrets |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` missing from secrets | High | Medium | Deploy step fails with clear auth error; artifact fallback URL keeps Slack working |
| Cloudflare Pages outage during deploy | Medium | Low | Triple-fallback URL in Slack ensures a clickable link always exists |
| `--branch main` omitted from deploy command | High | Low | Included in all deploy commands; omitting it produces a preview-only hash URL |
| 500 builds/month free cap exceeded | Medium | Low | ~220 builds/month at 5 active days/week × 2 workflows — well within 500 |

**Does this break the existing flow?** No. Artifact uploads and retention remain unchanged. The Slack URL chain falls back to the artifact URL if Cloudflare deploy fails. Only the primary URL improves.

**Rollback:** `git revert` the 2 workflow files. Zero impact on tests, configs, or helpers.

---

## 7. Final URLs

| Report | Stable URL | Source workflow |
|---|---|---|
| UI Tests (always latest) | `https://playwright-ui-reports.pages.dev` | `playwright-with-slack.yml` |
| API Tests — combined run (always latest) | `https://playwright-api-reports.pages.dev` | `playwright-with-slack.yml` |
| RESTful API Tests (always latest) | `https://playwright-restful-api-reports.pages.dev` | `api-restful-tests-with-slack.yml` |

Slack buttons in both workflows link directly to these URLs. No GitHub authentication required — stakeholders click once to see the report.

---

## 8. Validation Steps

### After Phase 1 (manual Cloudflare setup)

1. Confirm all 3 Pages projects exist in Cloudflare dashboard → **Workers & Pages**.
2. Confirm `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are added as repo secrets in GitHub.
3. Optional local smoke test: run `CLOUDFLARE_API_TOKEN=<token> npx wrangler@3 whoami` — should print your account name.

### After Phase 2–3 (CI workflow changes merged)

4. Trigger `playwright-with-slack.yml` via **Actions → workflow_dispatch** with `test_type: both`.
5. In the Actions run, check the `test-report` job logs — "Deploy UI monocart report" and "Deploy API monocart report" steps should each log `✨ Deployment complete!`.
6. Open `https://playwright-ui-reports.pages.dev` in an incognito window — monocart report should load with no login prompt.
7. Open `https://playwright-api-reports.pages.dev` — same.
8. Check the Slack message — "UI Report" and "API Report" buttons should open the Cloudflare URLs.
9. Trigger `api-restful-tests-with-slack.yml` via workflow_dispatch.
10. Check Slack "RESTful API Report" button opens `https://playwright-restful-api-reports.pages.dev`.
11. Re-trigger either workflow — same stable URLs still work (confirms "always latest" behaviour).

---

## 9. Decisions Made

1. **Project names confirmed:** `playwright-ui-reports`, `playwright-api-reports`, `playwright-restful-api-reports`.
2. **Separate sites per workflow:** `api-restful-tests-with-slack.yml` deploys to `playwright-restful-api-reports` — no cross-workflow overwrites.
3. **"Always latest" URL:** acceptable trade-off for free tier. Old Slack messages point to the most recent report, not the run-specific report.

---

## 10. Sources

- `.github/workflows/playwright-with-slack.yml` (reviewed lines 1–670)
- `.github/workflows/api-restful-tests-with-slack.yml` (reviewed lines 1–260)
- `playwright.config.ts` — monocart reporter config at lines 54–91
- `api.config.ts` — monocart reporter config at lines 50–91
- `package.json` — monocart-reporter v2.10.1, no existing wrangler dependency
- Cloudflare Pages pricing — unlimited bandwidth, 500 builds/month free
- Wrangler CLI docs — `wrangler pages deploy` command reference
- Previous research: `specs/monocart-netlify-hosting.research.md` (Netlify credit-pricing analysis)

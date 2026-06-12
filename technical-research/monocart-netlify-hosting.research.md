# Technical Research Report — Hosting monocart-reporter Reports on Netlify

**Date:** 2026-05-09
**Author:** technical-research-agent
**Status:** Research only — no code changes
**Approval gate:** Required before `technical-implementation-agent` runs

---

## 1. Summary

**What changes:** Add a deploy step to the existing `test-report` job in `.github/workflows/playwright-with-slack.yml` (and a parallel step in `.github/workflows/api-restful-tests-with-slack.yml`) that publishes the merged monocart UI report and the monocart API report to Netlify on every CI run. Slack message buttons swap from artifact-download URLs to per-run Netlify URLs that open the full interactive report in a browser, viewable by anyone (with no GitHub login required).

**Why:** Today the Slack "UI Report" / "API Report" buttons resolve to a GitHub artifact download URL. Recipients must (a) be authenticated to GitHub, (b) download the zip, (c) extract, (d) open `index.html` locally. A hosted URL collapses that to a single click and works for non-developer stakeholders.

**Recommended approach:** Two separate Netlify sites (`playwright-ui-reports`, `playwright-api-reports`), deployed via the official **Netlify CLI** (`netlify deploy --dir ... --alias <run-scoped>`) rather than the third-party `nwtgck/actions-netlify` action. Each deploy uses `--alias` keyed off `github.run_id` + `github.run_attempt` for predictable, collision-free URLs. The existing GitHub artifact uploads stay (shortened to 7 days) as a fallback for when Netlify is unreachable.

**Effort:** ~2 hours of CI editing + Netlify account/site setup. Zero changes to `playwright.config.ts`, `api.config.ts`, `package.json`, page objects, fixtures, or any helper class.

---

## 2. Review of the Existing Findings (`monocart-netlify-hosting-research.md`)

The desktop research file is mostly directionally correct but contains several inaccuracies and gaps that matter for this project.

### 2.1 Correct claims

- monocart's HTML report is self-contained and works on any static host. Confirmed.
- Netlify free tier permits commercial use. Confirmed (Vercel Hobby does not — that contrast is accurate).
- `--alias` produces predictable URLs of the form `https://{alias}--{site}.netlify.app`. Confirmed.
- Bandwidth math (~2 MB per deploy, ~1.8 GB/month at 30 deploys/day) is plausible for this project's CI cadence.
- The recommendation to keep two Netlify sites (one for UI, one for API) maps cleanly onto the existing `monocart-merged-ui/` vs `combined-results/api/monocart-api-report/` split, which **already exists** in `playwright-with-slack.yml` lines 320–326 and 388–394.

### 2.2 Incorrect or outdated claims

| Claim in existing research | Reality |
|---|---|
| "Free tier: 100 GB/month bandwidth, 300 build minutes/month" | Only true for **legacy** accounts (created before Sep 4, 2025). New accounts use **credit-based pricing**: 300 credits/month, hard cap, sites pause if exceeded. Deploys cost 15 credits each, bandwidth 20 credits/GB. |
| "Deploy retention: indefinite (draft deploys)" | **Wrong.** Free plan auto-deletes deploys after **30 days**. Paid plans 90 days. Enterprise up to 365. The Risks section of the desktop file mentions 90 days but the Platform Comparison table contradicts it. |
| "Build minutes 300/month (not consumed — static files, no build)" | Mostly true under legacy plans. Under credit pricing, **deploy itself** consumes 15 credits regardless of whether a build runs. |
| "Vercel free tier prohibits commercial use" | Vercel Hobby restricts commercial use, but this project is internal QA — borderline. Still a reason to prefer Netlify, but framing is sharper than necessary. |
| Slack output `${{ steps.netlify-ui.outputs.deploy-url }}` from `nwtgck/actions-netlify@v3.0` | Output name is correct, but the action's last release was **March 2024** — nearly 2 years stale. Recommend calling Netlify CLI directly instead. |
| "publish-dir: './monocart-merged-ui'" | Path is correct in CI but **only exists** after the merge step on lines 320–326 of `playwright-with-slack.yml`. Deploy step must be ordered after that step and gated on its success or path-existence. Existing research doesn't call out the ordering constraint. |
| The `api-restful-tests-with-slack.yml` workflow is not addressed at all | Separate workflow with its own Slack notification and its own monocart API report. Needs its own Netlify deploy step. |

### 2.3 Missing topics

- **History/trend mechanism:** the existing `actions/cache`-based `MONOCART_TREND_FILE` plumbing (`playwright-with-slack.yml` lines 104–115; `api-restful-tests-with-slack.yml` lines 52–62) is not discussed. Netlify hosting does **not** replace this — orthogonal concern.
- **Site visibility / data exposure:** monocart reports embed screenshots, video paths, console logs, traces. For an admin staging test, screenshots may show usernames, internal URLs, fixture data. Existing file mentions this risk in one row but proposes no concrete control.
- **Netlify CLI version pinning:** existing research uses `nwtgck/actions-netlify@v3.0` which pulls some `netlify-cli` version transitively. Pinning `npx netlify-cli@<exact>` is reproducible.
- **Concurrency:** matrix in `ui-test` runs windows-latest + macos-latest in parallel. Each shard saves its own artifact; `test-report` merges them. Netlify deploy happens in `test-report` (single job) — no concurrency hazard. If anyone moves deploy into the matrix job later, alias collisions would occur. Worth flagging.
- **Re-runs:** `run_attempt` increments on re-run; `run_id` does **not**. Existing research uses `run_id-run_attempt` — correct, but rationale not given.
- **Auth-token scoping:** Netlify personal access tokens are user-scoped, not site-scoped. Prefer a service account, not a developer's personal account.

---

## 3. Scope — Files Affected

### Workflow files (the only files that need to change)

| File | Change |
|---|---|
| `.github/workflows/playwright-with-slack.yml` | Add 2 deploy steps in `test-report` job (~lines 395–438 area). Add 2 outputs (`ui_deploy_url`, `api_deploy_url`). Update Slack `actions` block (lines 612–647) to use deploy URLs. |
| `.github/workflows/api-restful-tests-with-slack.yml` | Add 1 deploy step in `api-tests` job after line 124 (after `Upload monocart API report`). Add `api_deploy_url` output. Replace "Download Report" button URL on line 251. |

### Files NOT touched (verified)

- `playwright.config.ts` — unchanged
- `api.config.ts` — unchanged
- `package.json` — no new npm dependency. `netlify-cli` invoked via `npx` per-run.
- `tsconfig.json` — no path-alias changes
- `src/config/base-test.ts` — no fixture changes
- `src/pages/helpers/*` — no helper class changes
- `src/api/ApiTest.ts` — no API fixture changes
- All test specs — no test changes
- `Dockerfile` / `docker-compose.yml` — no container changes
- `lighthouserc.js`, Percy scripts — unrelated

### New files (optional, recommended)

| File | Purpose |
|---|---|
| `_headers` copied into `monocart-merged-ui/` and `monocart-api-report/` before deploy | Add `Access-Control-Allow-Origin: *` if Playwright trace `.zip` files are deployed; or basic-auth header if free-tier password gating chosen |

### New GitHub Actions secrets

| Secret | Source |
|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify user → User settings → Applications → Personal access tokens |
| `NETLIFY_UI_SITE_ID` | UI Netlify site → Site configuration → Site information → API ID |
| `NETLIFY_API_SITE_ID` | API Netlify site → Site configuration → Site information → API ID |

---

## 4. Options Compared

### 4.1 Hosting platform

| Option | Pros | Cons | Best for |
|---|---|---|---|
| **Netlify (recommended)** | Predictable `--alias` URLs, free-tier commercial use, simple two-secret model, built-in 30-day cleanup | Credit-based pricing has hard cap; password protection needs Pro plan | This project |
| Vercel | Generous build minutes | Hobby tier prohibits commercial use; predictable URLs need custom domain + wildcard DNS + alias step | Personal projects |
| GitHub Pages | Free, no third-party | One Pages site per repo; no per-run URLs without subpath gymnastics; deploys via gh-pages branch are racy | Single static report sites |
| Cloudflare Pages | Truly unlimited bandwidth on free | Hash-based per-build URL (not predictable from `run_id`); Wrangler auth setup; 500 builds/month cap | Teams already on Cloudflare |
| S3 + CloudFront | Full control | Heavy setup; per-run URLs require subpath routing; auth via Lambda@Edge | Orgs with existing AWS footprint |

**Verdict:** Netlify on simplicity. Cloudflare Pages a close second if hash URLs are acceptable.

### 4.2 Deployment mechanism (within Netlify)

| Option | Pros | Cons |
|---|---|---|
| **Netlify CLI (`npx netlify-cli@<pinned> deploy ...`) — recommended** | Official, pinnable, full flag set, supply chain = npm only | A few extra YAML lines |
| `nwtgck/actions-netlify@v3.0` | Slightly less YAML, exposes `deploy-url` | Stale (March 2024); third-party action; alias slugification quirks |
| Netlify Drop / manual upload | Zero CI plumbing | Manual; defeats automation |
| Netlify Build (connect Git) | No deploy step needed | Wrong shape — we publish CI artifacts, not source; would race with test job |

**Verdict:** Netlify CLI direct.

### 4.3 Site layout — one site or two?

| Option | Pros | Cons |
|---|---|---|
| **Two sites — recommended** | Independent retention, password, history; clean URLs; aligns with existing UI/API split | Two `*_SITE_ID` secrets |
| Single site, subpaths (`/ui/{run}/`, `/api/{run}/`) | One secret | Each deploy replaces site root; can't independently deploy from different jobs |
| Single site, two aliases | One secret | Both reports collide on `--prod`; coupled retention |

**Verdict:** Two sites.

### 4.4 Per-run URLs vs. single "latest"

| Option | Pros | Cons |
|---|---|---|
| **Per-run alias `--alias ui-{run_id}-{run_attempt}` — recommended** | Deep links work; can compare runs; audit-friendly | Auto-cleaned after 30 days on free tier (acceptable) |
| Always `--prod` (overwrite latest) | Always-stable URL | Loses history; old Slack messages break |
| Both (alias + prod) | Best of both | 2× deploy cost; extra step |

**Verdict:** Per-run alias only.

---

## 5. Recommended Approach

**Two Netlify sites + Netlify CLI invocation + per-run aliases + keep GitHub artifacts shortened to 7 days as fallback.**

### Justification tied to this project's CI shape

1. **`test-report` is already the merge job** — it downloads matrix shards, runs `npx monocart merge`, uploads merged artifacts. Adding two `npx netlify-cli deploy` calls there is the lowest-friction insertion point.
2. **Outputs exist at well-known paths** by deploy time: `monocart-merged-ui/` (line 326) and `combined-results/api/monocart-api-report/` (line 270–276). Both already include `index.html` + `index.json` + attachments.
3. **Slack notification is a downstream job** (`notify-slack` `needs: [test-report]`) — adding two new outputs from `test-report` is one-line each.
4. **No impact on tests, configs, helpers, fixtures.** Pure CI-tooling change, fully reversible.
5. **Compatible with existing trend cache.** Trend data is consumed *before* tests via `actions/cache`, not from Netlify.

### Recommended `netlify deploy` invocation

```bash
npx netlify-cli@17 deploy \
  --dir monocart-merged-ui \
  --site "$NETLIFY_UI_SITE_ID" \
  --auth "$NETLIFY_AUTH_TOKEN" \
  --alias "ui-${{ github.run_id }}-${{ github.run_attempt }}" \
  --message "UI run ${{ github.run_id }} attempt ${{ github.run_attempt }} on ${{ github.ref_name }}" \
  --json \
  > netlify-ui-deploy.json

DEPLOY_URL=$(node -e "console.log(require('./netlify-ui-deploy.json').deploy_url)")
echo "ui_deploy_url=$DEPLOY_URL" >> $GITHUB_OUTPUT
```

Pin `netlify-cli@17` (latest major as of research date). Avoid `@latest`.

### URL pattern produced

```
https://ui-15234567890-1--playwright-ui-reports.netlify.app
https://api-15234567890-1--playwright-api-reports.netlify.app
```

`run_id` is globally unique per repo; `run_attempt` disambiguates re-runs. Pattern length well under Netlify's 37-character alias cap.

---

## 6. Detailed Findings

### 6.1 Auth & visibility

monocart reports may include screenshots from logged-in admin views, fixture data, internal URLs, partial PII (test usernames, emails like `test{ts}@example.com` from `AdminTestDataGenerator`).

| Option | Cost | Setup |
|---|---|---|
| **Netlify Pro password protection** | $20/month/site | Toggle in dashboard. Styled password page. |
| Basic auth via `_headers` file on free tier | Free | Add `_headers` with `Basic-Auth: user:hashed` before deploy. Browser-native auth. Caveat: may be deprecated for new sites — verify. |
| Public URL with security-by-obscurity (UUID alias) | Free | Replace `{run_id}` with random UUID. Unguessable but technically public. |

**Recommendation:** Public per-run URLs are acceptable *only* if test data is fully synthetic (which `AdminTestDataGenerator` already is) and screenshots never capture real customer data. If unsure, start on Pro ($40/month for both sites). The decision should come from the Netlify account owner, not this report.

### 6.2 Retention & cleanup

Free plan auto-deletes deploys after **30 days** (corrected from existing research's "indefinite"). Desired behaviour — no cron job needed. If on Pro (90 days), the Netlify open-api `DELETE /sites/{site_id}/deploys/{deploy_id}` endpoint exists but is undocumented. Nightly cleanup workflow is feasible but **not recommended for v1**.

### 6.3 Cost estimate (under credit-based pricing)

For a typical CI cadence:
- 1 push to `main` → 1 UI + 1 API deploy = 30 credits
- 5 PRs/day → 5 × 2 deploys = 150 credits
- Daily total: ~180 credits
- Monthly (22 working days): **~3,960 credits**

Free Plan ceiling: 300 credits/month → **exceeds cap by 13×**.

**Implication:** the existing research's "fits free tier" conclusion is **incorrect under new credit pricing** for any active CI cadence. Honest options:

1. Personal ($9/month, 1,000 credits) — likely still over
2. Pro ($20/month, 3,000 credits) — likely still over for active repos
3. Throttle deploys to `push` to `main` + `workflow_dispatch` only (cheapest fix)
4. Use a **legacy account** (pre-Sep 2025) — flat 100 GB / 300 build minutes

**Verify the account type before sizing.**

### 6.4 History / trend — does Netlify replace `actions/cache`?

**No.** Different purposes.

- `actions/cache` (lines 104–115 in `playwright-with-slack.yml`) restores previous run's `index.json` *before* tests, sets `MONOCART_TREND_FILE`. `playwright.config.ts` reads it synchronously inside the monocart reporter config (lines 59–67) and embeds trend data into the next `index.html`.
- Netlify deploys *after* tests. Hosted `index.json` is not fetched by next CI run.

**Conclusion:** keep trend cache mechanism unchanged. Netlify hosting does not interact with it.

### 6.5 Slack integration — concrete output wiring

In `test-report` outputs block (lines 244–257), add:

```yaml
ui_deploy_url:  ${{ steps.netlify-ui.outputs.deploy_url }}
api_deploy_url: ${{ steps.netlify-api.outputs.deploy_url }}
```

In Slack `actions` block (lines 612–647), replace URLs on lines 628 and 636 with:

```yaml
"url": "${{ needs.test-report.outputs.ui_deploy_url || needs.test-report.outputs.ui_artifact_url || format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id) }}"
```

Triple-fallback ensures Slack always has a valid URL even if Netlify deploy fails.

For `api-restful-tests-with-slack.yml`, same pattern on the `api-tests` job — add `api_deploy_url` output, update line 251.

### 6.6 Trace viewer CORS

If `monocart-merged-ui/attachments/` includes `.zip` traces, add `_headers`:

```
/*
  Access-Control-Allow-Origin: *
```

File goes inside the deploy directory before `netlify deploy`. Verify empirically whether merged monocart includes traces.

### 6.7 Secrets management

- `NETLIFY_AUTH_TOKEN` — service-account user, not a developer's personal account. Personal tokens grant full access to all the user's sites.
- Both site IDs are non-secret (visible in URLs) but storing as repo secrets prevents accidental log exposure.
- Add to **repo secrets**, not org secrets, unless other repos use the same Netlify sites.

---

## 7. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Public URL exposes screenshots with PII or internal data | High | Medium | Keep tests synthetic-data-only; or Netlify Pro password protection; or UUID-based aliases |
| Credit-based plan cap exceeded → all sites pause | High | High (active repos) | Throttle deploys to `main` + `workflow_dispatch` only; or upgrade to Pro; or verify legacy account |
| Netlify outage during deploy | Medium | Low | Triple-fallback URL in Slack; keep GitHub artifact (7 days) |
| `--alias` collision between concurrent runs | Low | Very Low | `run_id` globally unique per repo; `run_attempt` disambiguates re-runs |
| Netlify CLI version drift breaks deploy | Medium | Low | Pin `npx netlify-cli@17`; revisit quarterly |
| Personal access token compromised | High | Low | Service account; rotate quarterly; scope to repo |
| `nwtgck/actions-netlify` action stale or compromised | Medium | Low | Avoid; call CLI directly |
| `_headers` basic-auth deprecation | Low | Low | Don't rely on it; use Pro plan native feature |
| `monocart-merged-ui/` empty when ui-test skipped | Low | Medium | Existing `if: needs.ui-test.result != 'skipped'` covers; mirror on deploy step |
| `test_type: api` workflow_dispatch → UI deploy step has no source | Low | Medium | Add `if: needs.ui-test.result == 'success'` on UI deploy |

**Does this break the existing artifact + Slack flow?** No. The artifact uploads stay. The Slack URL falls back to the artifact URL if `ui_deploy_url` is empty. Only the *primary* URL changes.

---

## 8. Implementation Steps (for `technical-implementation-agent` after user approval)

### Phase 1 — Netlify account setup (manual, one-time)

1. Confirm Netlify account type with owner: **legacy** or **credit-based**. Document.
2. Create site `playwright-ui-reports`. No Git connection. Note API ID.
3. Create site `playwright-api-reports`. Same. Note API ID.
4. (Optional) On Pro plan, enable site password protection on both; document password.
5. Create service-account user (or use existing bot). Generate personal access token.
6. In GitHub repo Secrets, add: `NETLIFY_AUTH_TOKEN`, `NETLIFY_UI_SITE_ID`, `NETLIFY_API_SITE_ID`.

### Phase 2 — Workflow changes (`playwright-with-slack.yml`)

7. After "Upload merged UI monocart report" (lines 380–386), add "Deploy UI monocart report to Netlify" step with `id: netlify-ui`. Use `npx netlify-cli@17 deploy --dir monocart-merged-ui --site "$NETLIFY_UI_SITE_ID" --auth "$NETLIFY_AUTH_TOKEN" --alias "ui-${{ github.run_id }}-${{ github.run_attempt }}" --message "..." --json > netlify-ui-deploy.json`. Parse `deploy_url` to `$GITHUB_OUTPUT`. Gate: `if: always() && needs.ui-test.result != 'skipped' && hashFiles('monocart-merged-ui/index.html') != ''`.
8. After "Upload API monocart report" (lines 388–394), add analogous "Deploy API monocart report to Netlify" with `id: netlify-api`, dir `combined-results/api/monocart-api-report`, alias `api-{run}-{attempt}`.
9. Add 2 outputs to `test-report` job (lines 244–257): `ui_deploy_url`, `api_deploy_url`.
10. Update Slack action button URLs (lines 628 and 636): triple-fallback chain.
11. Reduce GitHub artifact retention: change `retention-days: 30` to `retention-days: 7` on monocart-merged uploads (lines 386 and 394). Keep 30 days on `combined-test-report-*`.

### Phase 3 — Workflow changes (`api-restful-tests-with-slack.yml`)

12. After "Upload monocart API report" (lines 118–124), add Netlify deploy step to `playwright-api-reports` with alias `restful-api-{run}-{attempt}`.
13. Add output `api_deploy_url` to `api-tests` job (lines 31–35).
14. Replace "Download Report" button URL (line 251) with deploy URL + fallback chain.

### Phase 4 — Verification

15. Trigger `workflow_dispatch` on `playwright-with-slack.yml` with `test_type: both`. Verify Slack has clickable Netlify URLs.
16. Trigger again with `test_type: ui`. Verify UI URL works; API URL falls back.
17. Re-run same workflow. Verify `run_attempt=2` produces distinct alias and fresh URL.
18. Wait 24h. Confirm trend chart still renders next run (proves `actions/cache` unchanged).

### Phase 5 — Documentation

19. Update `CLAUDE.md` "monocart Reporter" section.
20. Add runbook note: "How to find an old test report on Netlify" + retention policy.

---

## 9. Validation

### Local

- `npx netlify-cli@17 --help` confirms install.
- `npx netlify-cli@17 deploy --dir monocart-report --site <ui-site-id> --auth <token> --alias local-test --json` should produce a working URL.
- Open URL in incognito — should load without auth.

### CI

- Slack message appears after `workflow_dispatch` run.
- Buttons clickable from non-developer Slack client.
- URL opens report without GitHub login.
- URL pattern: `https://ui-{run_id}-{run_attempt}--playwright-ui-reports.netlify.app`.
- After 30 days, URL returns Netlify "deploy not found" (proves auto-cleanup).

### Rollback

Change is contained in 2 workflow files. Rollback = `git revert` the workflow PR. No data migration, no test impact, no config impact.

---

## 10. Open Questions (must resolve before implementation)

1. **Netlify account type** — legacy (bandwidth-based) or new (credit-based)?
2. **Data sensitivity** — do staging/admin screenshots contain anything that cannot be public? Pro plan ($40/month total) needed?
3. **Deploy frequency** — every PR push, or `main` + `workflow_dispatch` only? Affects credit consumption ~5×.
4. **Trace files in deploy** — does `monocart-merged-ui/attachments/` include `.zip` traces? Determines whether `_headers` CORS is needed.
5. **Service-account Netlify user** — exists, or create new?
6. **API workflow dual-write** — should `api-restful-tests-with-slack.yml` write to the same `playwright-api-reports` site as `playwright-with-slack.yml`? Recommendation: yes, distinguished by alias prefix (`api-` vs `restful-api-`).

---

## 11. Hand-off

Per `CLAUDE.md` Agents section: this report is stage 1 of WORKFLOW-10. Implementation must wait for explicit user approval before `technical-implementation-agent` is dispatched. Even if the user says "just do it", the approval gate is a hard rule.

---

## Sources

- `.github/workflows/playwright-with-slack.yml`
- `.github/workflows/api-restful-tests-with-slack.yml`
- `playwright.config.ts`
- `api.config.ts`
- `package.json` — monocart-reporter v2.10.1, @playwright/test v1.59.1
- `C:\Users\ACER\Desktop\monocart-netlify-hosting-research.md` (existing desktop research, reviewed and corrected)
- Netlify CLI deploy command reference — https://cli.netlify.com/commands/deploy/
- Netlify pricing — https://www.netlify.com/pricing/
- Netlify deploy retention docs
- Netlify password protection docs
- Netlify credit-based billing FAQ
- actions-netlify (nwtgck) repo — last release v3.0.0 (March 2024)
- monocart-reporter README and examples

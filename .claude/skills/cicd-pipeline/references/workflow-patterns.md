# CI/CD Workflow Patterns

## Workflow overview

| File | Runner | Jobs | Trigger |
|---|---|---|---|
| `playwright-with-slack.yml` | windows-latest + macos-latest (matrix) | `ui-test` → `test-report` → `notify-slack` | push/PR to main/master/develop; workflow_dispatch |
| `api-restful-tests-with-slack.yml` | ubuntu-latest | `api-tests` → `notify-slack` | push/PR on `tests/api/**` or `src/api/**`; workflow_dispatch |
| `playwright.yml` | ubuntu-latest | single job | push/PR (basic, no Slack) |
| `api-restful-tests.yml` | ubuntu-latest | single job | push/PR (basic, no Slack) |
| `percy-visual-tests.yml` | ubuntu-latest | percy run | workflow_dispatch |
| `lighthouse-ci.yml` | ubuntu-latest | lhci collect+assert | workflow_dispatch |

---

## `playwright-with-slack.yml` — full pipeline

```
ui-test (windows-latest)  ─┐
ui-test (macos-latest)    ─┤→  test-report (merge + Slack outputs) → notify-slack
                            └   (fail-fast: false — both shards always run)
```

### workflow_dispatch inputs

| Input | Default | Options |
|---|---|---|
| `environment` | `testing` | testing, staging, production |
| `mode` | `parallel` | parallel, serial |
| `workers` | `4` | any integer |
| `browser` | `all` | all, chromium, firefox, webkit |
| `test_type` | `both` | both, ui, api |

`test_type: api` skips `ui-test` entirely (`if: inputs.test_type != 'api'`).

### Matrix strategy

```yaml
strategy:
  matrix:
    os: [windows-latest, macos-latest]
    include:
      - os: windows-latest
        shell: cmd
        script_ext: bat
      - os: macos-latest
        shell: bash
        script_ext: sh
  fail-fast: false
```

### monocart shard + merge pattern

```yaml
# In ui-test (each shard):
- name: Upload monocart shard
  uses: actions/upload-artifact@v4
  with:
    name: monocart-shard-${{ matrix.os }}-${{ github.run_id }}
    path: monocart-report/
    retention-days: 1

# In test-report (merge job):
- name: Download all monocart shards
  uses: actions/download-artifact@v4
  with:
    pattern: monocart-shard-*-${{ github.run_id }}
    path: shards/
    merge-multiple: true

- name: Merge monocart reports
  run: npx monocart merge 'shards/*/index.json' -o monocart-merged-ui/index.json
```

### Trend cache pattern

```yaml
- name: Restore monocart trend data
  uses: actions/cache@v4
  with:
    path: monocart-trend/index.json
    key: monocart-trend-ui-${{ runner.os }}-${{ github.ref_name }}
    restore-keys: monocart-trend-ui-${{ runner.os }}-

- name: Set monocart trend env
  if: steps.monocart-trend.outputs.cache-hit == 'true'
  run: echo "MONOCART_TREND_FILE=${{ github.workspace }}/monocart-trend/index.json" >> $GITHUB_ENV

# After tests — save updated index.json as new trend baseline:
- name: Save monocart trend data
  uses: actions/cache/save@v4
  with:
    path: monocart-trend/index.json
    key: monocart-trend-ui-${{ runner.os }}-${{ github.ref_name }}
```

Cache key is **branch-scoped** — first run on a new branch always misses (trend chart blank first time, normal).

### Job outputs for Slack

```yaml
# test-report job outputs:
outputs:
  tests:    ${{ steps.monocart.outputs.tests }}
  passed:   ${{ steps.monocart.outputs.passed }}
  failed:   ${{ steps.monocart.outputs.failed }}
  skipped:  ${{ steps.monocart.outputs.skipped }}
  flaky:    ${{ steps.monocart.outputs.flaky }}
  duration: ${{ steps.monocart.outputs.duration }}

# notify-slack reads: needs.test-report.outputs.*
```

---

## `api-restful-tests-with-slack.yml` — API pipeline

Single job on `ubuntu-latest`. No matrix. Serial execution (1 worker).

Path filter — only triggers on changes to:
- `tests/api/restful-api/**`
- `src/api/**`
- `src/data/restful-api-*`

Trend key: `monocart-trend-api-${{ github.ref_name }}`

Slack reads: `needs.api-tests.outputs.*`

---

## Required secrets

| Secret | Used by | Purpose |
|---|---|---|
| `SLACK_BOT_TOKEN` | both Slack workflows | Post to Slack channel |
| `SLACK_CHANNEL_ID` | both Slack workflows | Target channel |
| `PERCY_TOKEN` | `percy-visual-tests.yml` | Visual regression credits |

---

## Adding a new workflow input

1. Add under `workflow_dispatch.inputs` with `type: choice` or `type: string`
2. Add to the top-level `env:` block: `MY_VAR: ${{ github.event.inputs.my_var || 'default' }}`
3. Reference as `${{ env.MY_VAR }}` in steps

---

## Artifact retention policy

| Artifact | Retention | Purpose |
|---|---|---|
| `monocart-shard-*` | 1 day | Short-lived, merged into combined report |
| `monocart-merged-report-*` | 30 days | Full UI report post-merge |
| `monocart-api-report-*` | 30 days | Full API report |
| `combined-test-report-*` | 30 days | html + json + junit combined |
| `test-results-*` | 7 days | Raw trace/screenshot/video |

---

## Lighthouse CI pattern

```yaml
- name: Run LHCI
  run: npm run lhci:run
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

`lhci:run` = collect + upload + assert in sequence. Assert thresholds defined in `lighthouserc.js`.

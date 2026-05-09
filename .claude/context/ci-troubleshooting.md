# CI Troubleshooting

## Workflows

| Workflow | Trigger | Jobs |
|---|---|---|
| `playwright-with-slack.yml` | push/PR/dispatch | `ui-test` (matrix: windows+macos) → `test-report` (merge) → `notify-slack` |
| `api-restful-tests-with-slack.yml` | push/PR/dispatch | `api-tests` → `notify-slack` |

## Common failures

### TIMEOUT — element not found / page load slow

- Check if the target environment is up: frontsite and CMS are Azure App Services — they cold-start after idle.
- Increase `TIMEOUT` in the relevant `.env.*` file or use `TIMEOUTS.PAGE_LOAD` constant.
- Run `npm run test:serial` locally to isolate (1 worker, no race conditions).

### SELECTOR_STALE — locator no longer matches

- App HTML changed. Run `npm run test:headed` to watch the failure.
- Update the locator in the relevant page object. Prefer `getByRole`/`getByText` over CSS.

### NETWORK — API call failed / 503

- Restful Booker (`restful-booker.herokuapp.com`) is a public demo — cold-start delay is normal. Retry once.
- GraphQL (`stag-platypus-au.accentgra.com`) — staging only, not reachable from production runs.

### AUTH — login fails

- Verify `USER_NAME` / `PASSWORD` in `.env.testing` against the CMS.
- CMS session may have expired — re-run the login test first.

### monocart merge fails in `test-report` job

- Check that all matrix shards uploaded their artifact (`monocart-report-*`).
- Artifact download step uses `merge-multiple: true` — ensure shard names are unique.
- Local repro: `npx monocart merge [...json files] -o merged-report/index.json`.

### Slack notification missing

- `notify-slack` needs `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` secrets set in GitHub repo settings.
- Check `needs.test-report.outputs.*` — if `test-report` job was skipped, outputs are empty.

### GitHub Actions cache miss (monocart trend blank)

- `MONOCART_TREND_FILE` / `MONOCART_API_TREND_FILE` are set via `actions/cache` restore.
- Cache key includes branch name — first run on a new branch will always miss (expected).
- Check cache hit/miss in the "Restore monocart trend" step logs.

## Useful commands for diagnosis

```bash
# Run single failing test with debug
npx playwright test <file> --headed --project=chromium

# Run with trace on (for post-mortem)
TRACE_MODE=on npx playwright test <file>

# Open last trace
npx playwright show-trace test-results/**/trace.zip

# Check type errors after editing
npm run lint
```

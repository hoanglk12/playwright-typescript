# Environment Reference

Load with: `NODE_ENV=<env> npm test` — reads `.env.<env>` from project root.

## Testing (default)

| Service | URL |
|---|---|
| Frontsite | `https://ff-fieldfishercom-qa-web-ekfefjdmh6dbg3f7.uksouth-01.azurewebsites.net/en` |
| CMS/Admin | `https://ff-fieldfishercom-qa-cms-a4axd5cbatb7g4eu.uksouth-01.azurewebsites.net/CMSPages/logon.aspx` |
| Restful Booker API | `https://restful-booker.herokuapp.com` |
| Restful API Dev | `https://api.restful-api.dev` |
| GraphQL | `https://stag-platypus-au.accentgra.com/graphql` |

**Auth:** `USER_NAME=Hoang.Pham` / `PASSWORD` in `.env.testing`

## Staging

| Service | URL |
|---|---|
| API Base | `https://api-staging.guru99.com` |

## Production

| Service | URL |
|---|---|
| API Base | `https://api.guru99.com` |

> Never run `npm run test:production` without explicit approval — targets live environment.

## Key env vars

| Var | Purpose |
|---|---|
| `NODE_ENV` | Selects `.env.<value>` file |
| `WORKERS` | Worker count (`30%`, `50%`, or integer) |
| `HEADLESS` | `true`/`false` |
| `TRACE_MODE` | `on-first-retry` / `on` / `off` |
| `SCREENSHOT_MODE` | `only-on-failure` / `on` / `off` |
| `PERCY_TOKEN` | Visual regression — omit to skip Percy silently |
| `MONOCART_TREND_FILE` | Path to previous run's `index.json` for trend chart |
| `MONOCART_API_TREND_FILE` | Same for API report |

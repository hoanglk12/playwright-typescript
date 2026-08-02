/**
 * scripts/council/tiers.mjs
 *
 * v1 default (and only) model panel for /council-review. Endpoint is
 * https://direct.shopaikey.com/v1 (ShopAIKey), NOT OpenRouter — see
 * docs/technical-research/ai-council-dispatch.research.md §8.6 / §10 Phase 0.
 *
 * The two slugs below were VERIFIED against a live GET /v1/models call on
 * 2026-08-02 — the endpoint exists and returns 200 with both slugs present
 * (see client.mjs's fetchModelCatalog() comment for why that response still
 * carries no pricing data).
 *
 * glm-5.2 was dropped from the panel (2026-08-02): confirmed via live run +
 * curl unable to complete a review-length (~17KB) prompt even at
 * max_tokens=4000 (a reasoning-heavy model that spent the whole budget on
 * reasoning_content, none on content, finish_reason "length"). Re-add only
 * if a working max_tokens value is verified for prompts this size.
 */

export const KIMI_K3 = 'kimi-k3';
export const GPT_SOL_5_6 = 'gpt-5.6-sol';

/** Slug -> provider family, for jurisdiction disclosure in the manifest. */
export const MODEL_FAMILIES = {
  [KIMI_K3]: 'Moonshot AI (China) — via ShopAIKey',
  [GPT_SOL_5_6]: 'OpenAI-compatible, vendor unconfirmed — via ShopAIKey',
};

/** Slugs that reject any `temperature` field with HTTP 400 regardless of
 * value (presence alone breaks the call) — confirmed for kimi-k3 via curl
 * on 2026-08-02. client.mjs's chat() must omit the key entirely for these. */
export const MODELS_WITHOUT_TEMPERATURE = new Set([KIMI_K3]);

/**
 * USD price per 1,000,000 tokens, scraped from the embedded RSC data payload
 * of https://shopaikey.com/models on 2026-08-02 (the public pricing page —
 * NOT the /v1/models API, which returns no pricing field at all). Verified
 * unit against a known reference row on the same page: gpt-4o-mini reads
 * input:0.15/completion:0.6, matching OpenAI's published $0.15/$0.60 per 1M
 * exactly, so these are $/1M, not $/1K or per-request.
 *
 * ShopAIKey exposes no pricing API, so there is no automated way to detect
 * drift — re-scrape the page before trusting these figures long-term.
 */
export const PRICING_PER_MILLION_TOKENS_USD = {
  [KIMI_K3]: { input: 20, completion: 100, cacheRead: 2 },
  [GPT_SOL_5_6]: { input: 5, completion: 40, cacheRead: 0.5 },
};

/**
 * Per-model max_tokens floor, applied only when the caller did not pass an
 * explicit --max-tokens. kimi-k3 is a reasoning model: confirmed live on
 * 2026-08-02 that it can spend its entire completion budget on hidden
 * `reasoning_content` before writing `content` on a review-length (~15KB /
 * ~3800-prompt-token) input — reproduced exactly at the v1 default of 1200
 * (finish_reason "length", 1197/1200 tokens on reasoning_content, 0 on
 * content). This is the same failure class as the glm-5.2 issue above, not
 * a new bug — see client.mjs's EMPTY_CONTENT handling for the runtime
 * detection. 8000 is a working hypothesis, not yet empirically confirmed:
 * verification hit transient ShopAIKey capacity errors (HTTP 529
 * "服务当前过载" / 503 "no available channel") unrelated to this fix,
 * before a successful non-empty completion could be captured. Re-verify
 * with a real run and lower this if 8000 proves wasteful for typical
 * review-sized prompts, or raise it if still insufficient.
 */
export const MODEL_MAX_TOKENS_OVERRIDE = {
  [KIMI_K3]: 8000,
};

/**
 * The only panel shipped in v1. `context_length` stays null — no confirmed
 * source for it (the pricing-page scrape above does not carry it, and
 * /v1/models has no such field either).
 */
export const DEFAULT_PANEL = [KIMI_K3, GPT_SOL_5_6].map(slug => ({
  slug,
  family: MODEL_FAMILIES[slug],
  pricingPerMillionUsd: PRICING_PER_MILLION_TOKENS_USD[slug],
  context_length: null,
}));

/** Floating "latest" aliases break pinned cost estimates and pinned behaviour. */
export function assertPinnedSlug(slug) {
  if (slug.startsWith('~')) {
    throw new Error(`Model slug "${slug}" starts with "~" — floating "latest" aliases are not allowed. Pin an explicit version.`);
  }
}

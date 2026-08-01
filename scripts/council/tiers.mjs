/**
 * scripts/council/tiers.mjs
 *
 * v1 default (and only) model panel for /council-review. Endpoint is
 * https://direct.shopaikey.com/v1 (ShopAIKey), NOT OpenRouter — see
 * docs/technical-research/ai-council-dispatch.research.md §8.6 / §10 Phase 0.
 *
 * The two slugs below are USER-SUPPLIED and UNVERIFIED against a live
 * /models call, decided 2026-08-02. ShopAIKey may not expose that endpoint
 * at all (see client.mjs's fetchModelCatalog() fail-soft handling). Before
 * relying on either as a default, smoke-test the slug with --max-tokens=16
 * and confirm a 200 with non-empty content — a 404/400 means that slug must
 * not ship until its correct identifier is confirmed.
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
 * The only panel shipped in v1. `pricing` / `context_length` are null for
 * both because ShopAIKey's catalog (if any) is unconfirmed — the cost
 * estimator must print "UNKNOWN", never "$0.00" (report §10 Phase 0
 * model-selection note).
 */
export const DEFAULT_PANEL = [KIMI_K3, GPT_SOL_5_6].map(slug => ({
  slug,
  family: MODEL_FAMILIES[slug],
  pricing: null,
  context_length: null,
}));

/** Floating "latest" aliases break pinned cost estimates and pinned behaviour. */
export function assertPinnedSlug(slug) {
  if (slug.startsWith('~')) {
    throw new Error(`Model slug "${slug}" starts with "~" — floating "latest" aliases are not allowed. Pin an explicit version.`);
  }
}

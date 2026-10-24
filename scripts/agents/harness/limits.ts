export const AGENT_WALL_CLOCK_MS = 8 * 60 * 1000;
export const DELIVERY_HTTP_TIMEOUT_MS = 30 * 1000;

export const MAX_DIFF_CHARS = 60_000;
export const MAX_FILE_CHARS = 40_000;
export const MAX_TOOL_TEXT_CHARS = 20_000;
export const MAX_OUTPUT_FIELD_CHARS = 2_000;
export const MAX_RENDERED_CHARS = 60_000;
export const MAX_STDERR_TAIL_CHARS = 2_000;
export const MAX_FINDINGS = 20;
export const MAX_EVIDENCE_CHARS = 200;
export const MAX_SUGGESTION_CHARS = 300;
export const MAX_SUMMARY_CHARS = 600;
export const MAX_PATH_CHARS = 300;
export const CONVENTION_EVAL_DEFAULT_REPEATS = 2;
export const MAX_PARITY_EXPLANATION_CHARS = 300;
export const MAX_PARITY_MISSING_CHANGE_CHARS = 300;
export const PAIR_DIFF_CONTEXT_LINES = 3;

export const CONVENTION_REVIEWER_MAX_TURNS = 8;
export const CONVENTION_REVIEWER_MAX_BUDGET_USD = 0.75;
export const MIRROR_PARITY_MAX_TURNS = 4;
export const MIRROR_PARITY_MAX_BUDGET_USD = 0.25;
export const FAILURE_TRIAGE_MAX_TURNS = 15;
export const FAILURE_TRIAGE_MAX_BUDGET_USD = 1.0;
export const FLAKY_ANALYST_MAX_TURNS = 6;
export const FLAKY_ANALYST_MAX_BUDGET_USD = 1.0;
export const UPGRADE_IMPACT_MAX_TURNS = 15;
export const UPGRADE_IMPACT_MAX_BUDGET_USD = 2.0;

export const MANAGED_SETTINGS_KEY_ALLOWLIST: readonly string[] = [];

export const TEMP_DIR_RM_MAX_RETRIES = 3;
// Observed in the first live init message (V1.1): the CLI implements outputFormat as this tool.
export const EXTRA_ALLOWED_TOOLS: readonly string[] = ['StructuredOutput'];
// Built-in agents that no isolation switch removes (V1.1). They are reachable only through the Agent tool,
// which the init tools check rejects. Exact names, so an SDK upgrade or an injected agent still fails closed.
export const BUILTIN_AGENT_ALLOWLIST: readonly string[] = ['claude', 'general-purpose', 'statusline-setup'];

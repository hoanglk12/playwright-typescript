/**
 * scripts/council/panels.mjs
 *
 * Pure data + prompt-builder module for the LLM Council multi-provider tool
 * (scripts/council/). No I/O, no network — see openrouter.mjs for the HTTP layer.
 *
 * Panel definitions here mix US (OpenAI, Google, Anthropic, xAI) and Chinese
 * (DeepSeek) providers in the default panel — an explicit, disclosed user
 * decision. See CLAUDE.md "LLM Council" section for the full rationale.
 *
 * NOTE: slugs below are OpenRouter-format placeholders. The HTTP layer
 * (openrouter.mjs) now points at https://direct.shopaikey.com/v1 — update
 * these to ShopAIKey's actual model IDs before running for real.
 */

export const HARD_CAPS = {
  MAX_PANEL: 6,
  MIN_PANEL: 3,
  DEFAULT_MAX_COST_USD: 0.5,
  DEFAULT_TIMEOUT_MS: 120000,
  RETRIES: 2,
};

const DEFAULT_MAX_TOKENS = { opinion: 400, review: 300, synthesis: 800 };

/**
 * Model slug → provider family, used for manifest/report display and the
 * data-residency + vendor-collision disclosures.
 */
export const MODEL_FAMILIES = {
  'gpt-5.4-mini': 'OpenAI (US)',
  'gpt-5.6-sol': 'OpenAI (US)',
  'gpt-5.1': 'OpenAI (US)',
  'gpt-5-nano': 'OpenAI (US)',
  'gpt-5-mini': 'OpenAI (US)',
  'gemini-3.1-flash-lite': 'Google (US)',
  'gemini-3.1-pro-preview': 'Google (US)',
  'gemini-2.5-flash-lite': 'Google (US)',
  'claude-haiku-4-5-20251001': 'Anthropic (US)',
  'claude-sonnet-5': 'Anthropic (US)',
  'grok-4': 'xAI (US)',
  'kimi-k3': 'Moonshot AI (China)',
  'glm-4-flash': 'Z.ai / Zhipu (China)',
};

export function familyOf(slug) {
  return MODEL_FAMILIES[slug] ?? 'Unknown provider';
}

/**
 * Named panels. `default` is the everyday panel (persona-per-panelist by
 * default, see PERSONAS below). `quality` is a higher-cost override for
 * decisions that warrant flagship models. `smoke` is a near-free panel for
 * validating the pipeline itself.
 */
export const PANELS = {
  default: {
    models: [
      'gpt-5.4-mini',
      'gemini-3.1-flash-lite',
      'claude-haiku-4-5-20251001',
      'grok-4',
      'kimi-k3',
    ],
    chairman: 'gpt-5.6-sol',
    maxTokens: { ...DEFAULT_MAX_TOKENS },
  },
  quality: {
    models: [
      'gpt-5.1',
      'gemini-3.1-pro-preview',
      'claude-sonnet-5',
     ],
    chairman: 'gpt-5.1',
    maxTokens: { ...DEFAULT_MAX_TOKENS },
  },
  smoke: {
    models: [
      'gpt-5-nano',
      'gemini-2.5-flash-lite',
      'glm-4-flash',
    ],
    chairman: 'gpt-5-mini',
    maxTokens: { ...DEFAULT_MAX_TOKENS, opinion: 200 },
  },
};

/**
 * The 5 advisor personas, copied verbatim from
 * .claude/skills/llm-council/SKILL.md (lines ~26-35) so the two tools stay
 * in sync on thinking-style descriptions.
 */
export const PERSONAS = [
  {
    name: 'The Contrarian',
    description:
      "Actively looks for what's wrong, what's missing, what will fail. Assumes the idea has a fatal flaw and tries to find it. If everything looks solid, digs deeper. The Contrarian is not a pessimist. They're the friend who saves you from a bad deal by asking the questions you're avoiding.",
  },
  {
    name: 'The First Principles Thinker',
    description:
      'Ignores the surface-level question and asks "what are we actually trying to solve here?" Strips away assumptions. Rebuilds the problem from the ground up. Sometimes the most valuable council output is the First Principles Thinker saying "you\'re asking the wrong question entirely."',
  },
  {
    name: 'The Expansionist',
    description:
      "Looks for upside everyone else is missing. What could be bigger? What adjacent opportunity is hiding? What's being undervalued? The Expansionist doesn't care about risk (that's the Contrarian's job). They care about what happens if this works even better than expected.",
  },
  {
    name: 'The Outsider',
    description:
      'Has zero context about you, your field, or your history. Responds purely to what\'s in front of them. This is the most underrated advisor. Experts develop blind spots. The Outsider catches the curse of knowledge: things that are obvious to you but confusing to everyone else.',
  },
  {
    name: 'The Executor',
    description:
      'Only cares about one thing: can this actually be done, and what\'s the fastest path to doing it? Ignores theory, strategy, and big-picture thinking. The Executor looks at every idea through the lens of "OK but what do you do Monday morning?" If an idea sounds brilliant but has no clear first step, the Executor will say so.',
  },
];

/**
 * Index-based mapping of PANELS.default.models[i] → PERSONAS[i].name.
 * Trivially editable: change the order here to reassign personas without
 * touching PANELS.default.models.
 *
 * Unlike the Claude-subagent version of this persona in
 * .claude/skills/llm-council/SKILL.md (which cannot avoid Claude Code's
 * automatic CLAUDE.md injection), the Outsider here can genuinely have zero
 * project context, because this tool does no automatic workspace scanning —
 * context only enters via --context=.
 */
export const DEFAULT_PERSONA_ASSIGNMENT = [
  'The Contrarian',
  'The First Principles Thinker',
  'The Expansionist',
  'The Outsider',
  'The Executor',
];

export function personaFor(name) {
  return PERSONAS.find(p => p.name === name) ?? null;
}

export const NEUTRAL_SYSTEM =
  'Respond directly to the question below. Take a clear position — do not hedge, ' +
  'do not present both sides equally, do not pad with disclaimers or caveats. ' +
  'Answer in 150-300 words. No preamble, no restating the question — go straight ' +
  'into your analysis.';

/** Builds the stage-1 independent-opinion prompt (persona or neutral). */
export function buildOpinionPrompt({ framedQuestion, persona = null }) {
  if (!persona) {
    return { system: NEUTRAL_SYSTEM, user: framedQuestion };
  }
  const system =
    `You are ${persona.name} on an LLM Council.\n` +
    `Your thinking style: ${persona.description}\n\n` +
    "Respond from your perspective. Be direct and specific. Don't hedge or try to be " +
    'balanced. Lean fully into your assigned angle. The other advisors will cover the ' +
    "angles you're not covering.\n" +
    'Keep your response between 150-300 words. No preamble. Go straight into your analysis.';
  return { system, user: framedQuestion };
}

/** Builds the stage-2 anonymous peer-review prompt. `anonymized` = [{ letter, text }]. */
export function buildReviewPrompt({ framedQuestion, anonymized }) {
  const letters = anonymized.map(a => a.letter);
  const responsesBlock = anonymized
    .map(a => `**Response ${a.letter}:**\n${a.text}`)
    .join('\n\n');
  const rankingExample = letters.length ? letters.join(' > ') : 'B > D > A > E > C';

  const user =
    `You are reviewing the outputs of an LLM Council. ${anonymized.length} advisors ` +
    'independently answered this question:\n' +
    '---\n' +
    `${framedQuestion}\n` +
    '---\n' +
    'Here are their anonymized responses:\n\n' +
    `${responsesBlock}\n\n` +
    'Answer these three questions. Be specific. Reference responses by letter. Do not ' +
    'speculate about which model wrote which response — judge content only.\n' +
    '1. Which response is the strongest? Why?\n' +
    '2. Which response has the biggest blind spot? What is it missing?\n' +
    '3. What did ALL responses miss that the council should consider?\n\n' +
    'Keep your review under 200 words. Be direct.\n\n' +
    'End your review with a final line in exactly this format (all letters, most to ' +
    `least convincing):\nRANKING: ${rankingExample}`;

  return { system: null, user };
}

/**
 * Builds the stage-3 chairman synthesis prompt. `attributedResponses` and
 * `reviews` are de-anonymized display-ready entries: [{ label, text }].
 * Headings copied verbatim from SKILL.md's chairman template.
 */
export function buildSynthesisPrompt({ framedQuestion, attributedResponses, reviews }) {
  const responsesBlock = attributedResponses.map(r => `**${r.label}:**\n${r.text}`).join('\n\n');
  const reviewsBlock = reviews.length
    ? reviews.map(r => `**${r.label}:**\n${r.text}`).join('\n\n')
    : '*(No peer reviews were available — proceed using only the independent responses above.)*';

  const user =
    'You are the Chairman of an LLM Council. Your job is to synthesize the work of ' +
    `${attributedResponses.length} advisors and their peer reviews into a final verdict.\n\n` +
    'The question brought to the council:\n' +
    '---\n' +
    `${framedQuestion}\n` +
    '---\n\n' +
    `ADVISOR RESPONSES:\n${responsesBlock}\n\n` +
    `PEER REVIEWS:\n${reviewsBlock}\n\n` +
    'Produce the council verdict using this exact structure:\n\n' +
    '## Where the Council Agrees\n' +
    '[Points multiple advisors converged on independently. These are high-confidence signals.]\n\n' +
    '## Where the Council Clashes\n' +
    '[Genuine disagreements. Present both sides. Explain why reasonable advisors disagree.]\n\n' +
    '## Blind Spots the Council Caught\n' +
    '[Things that only emerged through peer review. Things individual advisors missed that others flagged.]\n\n' +
    '## The Recommendation\n' +
    '[A clear, direct recommendation. Not "it depends." A real answer with reasoning.]\n\n' +
    '## The One Thing to Do First\n' +
    '[A single concrete next step. Not a list. One thing.]\n\n' +
    "Be direct. Don't hedge. The whole point of the council is to give the user clarity " +
    "they couldn't get from a single perspective.";

  return { system: null, user };
}

/**
 * Patterns used to strip explicit self-identification during anonymization.
 * Not exhaustive — a model can still leak identity through writing style,
 * which is why report.mjs's anonymization caveat is worded as "nominal."
 */
export const SELF_ID_PATTERNS = [
  { pattern: /\bChatGPT\b/gi, replacement: 'an AI assistant' },
  { pattern: /\bGPT-?\d[\w.]*\b/gi, replacement: 'an AI model' },
  { pattern: /\bClaude\b/gi, replacement: 'an AI assistant' },
  { pattern: /\bGemini\b/gi, replacement: 'an AI model' },
  { pattern: /\bGrok\b/gi, replacement: 'an AI model' },
  { pattern: /\bDeepSeek\b/gi, replacement: 'an AI model' },
  { pattern: /\bMistral(?:\s?AI)?\b/gi, replacement: 'an AI provider' },
  { pattern: /\bLlama\b/gi, replacement: 'an AI model' },
  { pattern: /\bQwen\b/gi, replacement: 'an AI model' },
  { pattern: /\bAnthropic\b/gi, replacement: 'a provider' },
  { pattern: /\bOpenAI\b/gi, replacement: 'a provider' },
  { pattern: /\bGoogle\b/gi, replacement: 'a provider' },
  { pattern: /\bxAI\b/gi, replacement: 'a provider' },
];

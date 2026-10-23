import type { z } from 'zod';
import type { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';

export type AuthMode = 'subscription-oauth' | 'api-key';

export type AgentTool = NonNullable<Parameters<typeof createSdkMcpServer>[0]['tools']>[number];

export interface AgentSpec<TOutput> {
  name: string;
  systemPrompt: string;
  tools: AgentTool[];
  outputSchema: z.ZodType<TOutput>;
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
}

export type RunOutcome =
  | 'success'
  | 'agent-error'
  | 'invariant-violation'
  | 'usage-exhausted'
  | 'auth-failed'
  | 'timeout';

export interface ModelTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

export interface RateLimitSummary {
  status: string;
  rateLimitType?: string;
  resetsAt?: number;
  utilization?: number;
  errorCode?: string;
}

export interface AgentRunReport<TOutput> {
  agent: string;
  outcome: RunOutcome;
  resultSubtype?: string;
  output?: TOutput;
  costUsdEstimate: number;
  numTurns: number;
  modelUsage: Record<string, ModelTokenUsage>;
  permissionDenials: number;
  apiKeySource?: string;
  claudeCodeVersion?: string;
  resolvedModel?: string;
  rateLimit?: RateLimitSummary;
  managedSettingsKeys: string[];
  durationMs: number;
  errors: string[];
}

export interface ToolError {
  ok: false;
  error: string;
}

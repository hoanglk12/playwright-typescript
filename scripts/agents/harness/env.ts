import type { AuthMode } from './types.ts';

const BASE_PASSTHROUGH: readonly string[] = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG'];
const WINDOWS_PASSTHROUGH: readonly string[] = [
  'SystemRoot',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'ComSpec',
  'PATHEXT',
];

const CREDENTIAL_VAR: Record<AuthMode, string> = {
  'subscription-oauth': 'CLAUDE_CODE_OAUTH_TOKEN',
  'api-key': 'ANTHROPIC_API_KEY',
};

export const DEFAULT_AUTH_MODE: AuthMode = 'subscription-oauth';

export function parseAuthMode(raw: string | undefined): AuthMode {
  if (raw === undefined || raw === '') return DEFAULT_AUTH_MODE;
  if (raw === 'subscription-oauth' || raw === 'api-key') return raw;
  throw new Error(`AGENT_AUTH_MODE must be 'subscription-oauth' or 'api-key'`);
}

export function credentialVarFor(authMode: AuthMode): string {
  return CREDENTIAL_VAR[authMode];
}

export function buildAgentEnv(
  authMode: AuthMode,
  configDir: string,
  parentEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const isWindows = process.platform === 'win32';
  const passthrough = isWindows ? [...BASE_PASSTHROUGH, ...WINDOWS_PASSTHROUGH] : BASE_PASSTHROUGH;
  const normalize = (name: string): string => (isWindows ? name.toUpperCase() : name);
  const allowed = new Set(passthrough.map(normalize));

  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(parentEnv)) {
    if (value !== undefined && allowed.has(normalize(name))) env[name] = value;
  }

  const credentialVar = credentialVarFor(authMode);
  const credential = parentEnv[credentialVar];
  if (credential === undefined || credential === '') {
    throw new Error(`${credentialVar} is required for auth mode '${authMode}' but is not set`);
  }

  return {
    ...env,
    CLAUDE_CONFIG_DIR: configDir,
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS: '1',
    // Scrub=1 forces permissionMode to 'default', which defeats dontAsk. With tools: [] and an in-process
    // MCP server there is no subprocess for it to protect, so opt out explicitly.
    CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '0',
    [credentialVar]: credential,
  };
}

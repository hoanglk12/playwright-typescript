import type { AuthMode } from './types.ts';

export interface InitMessageView {
  tools: readonly string[];
  mcp_servers: readonly { name: string; status: string }[];
  plugins: readonly { name: string }[];
  skills: readonly string[];
  agents?: readonly string[];
  permissionMode: string;
  apiKeySource: string;
}

export interface InitExpectation {
  serverName: string;
  authMode: AuthMode;
  extraAllowedTools: readonly string[];
  allowedAgents: readonly string[];
}

const EXPECTED_API_KEY_SOURCE: Record<AuthMode, string> = {
  'subscription-oauth': 'none',
  'api-key': 'ANTHROPIC_API_KEY',
};

export function checkInitMessage(init: InitMessageView, expected: InitExpectation): string[] {
  const violations: string[] = [];
  const toolPrefix = `mcp__${expected.serverName}__`;

  const requiredArrays: Record<string, unknown> = {
    tools: init.tools,
    mcp_servers: init.mcp_servers,
    plugins: init.plugins,
    skills: init.skills,
  };
  for (const [name, value] of Object.entries(requiredArrays)) {
    if (!Array.isArray(value)) violations.push(`init message ${name} must be an array`);
  }
  if (violations.length > 0) return violations;

  for (const tool of init.tools) {
    if (!tool.startsWith(toolPrefix) && !expected.extraAllowedTools.includes(tool)) {
      violations.push(`unexpected tool in context: ${tool}`);
    }
  }

  const servers = init.mcp_servers;
  const onlyExpectedServer =
    servers.length === 1 && servers[0].name === expected.serverName && servers[0].status === 'connected';
  if (!onlyExpectedServer) {
    const actualServers = servers.map((s) => `${s.name}:${s.status}`).join(', ');
    violations.push(`mcp_servers must be exactly [${expected.serverName}] connected, got [${actualServers}]`);
  }

  // Names only: a plugin's path can expose the runner's home directory.
  const pluginNames = init.plugins.map((p) => p.name);
  const unexpectedAgents = (init.agents ?? []).filter((agent) => !expected.allowedAgents.includes(agent));
  if (pluginNames.length > 0) violations.push(`plugins must be empty, got [${pluginNames.join(', ')}]`);
  if (init.skills.length > 0) violations.push(`skills must be empty, got [${init.skills.join(', ')}]`);
  if (unexpectedAgents.length > 0) violations.push(`unexpected agents: [${unexpectedAgents.join(', ')}]`);

  if (init.permissionMode !== 'dontAsk') {
    violations.push(`permissionMode must be dontAsk, got ${init.permissionMode}`);
  }

  const expectedSource = EXPECTED_API_KEY_SOURCE[expected.authMode];
  if (init.apiKeySource !== expectedSource) {
    violations.push(
      `apiKeySource must be ${expectedSource} for ${expected.authMode}, got ${init.apiKeySource}`,
    );
  }

  return violations;
}

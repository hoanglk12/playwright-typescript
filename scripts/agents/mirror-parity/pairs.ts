import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const MIRROR_PAIR_IDS = ['lighthouserc-desktop', 'lighthouserc-mobile', 'lhci-index', 'devops-check-ci'] as const;
export type MirrorPairId = (typeof MIRROR_PAIR_IDS)[number];

export type PairRuleId = 'bitbucket-lighthouse' | 'ci-failure-taxonomy';

export interface MirrorPair {
  id: MirrorPairId;
  source: string;
  mirror: string;
  rule: PairRuleId;
}

export const MIRROR_PAIRS: readonly MirrorPair[] = [
  { id: 'lighthouserc-desktop', source: 'lighthouserc.js', mirror: 'lighthouserc.bitbucket.js', rule: 'bitbucket-lighthouse' },
  {
    id: 'lighthouserc-mobile',
    source: 'lighthouserc.mobile.js',
    mirror: 'lighthouserc.mobile.bitbucket.js',
    rule: 'bitbucket-lighthouse',
  },
  {
    id: 'lhci-index',
    source: 'scripts/generate-lhci-index.js',
    mirror: 'scripts/generate-lhci-index.bitbucket.js',
    rule: 'bitbucket-lighthouse',
  },
  {
    id: 'devops-check-ci',
    source: '.claude/agents/devops-cicd-specialist.md',
    mirror: '.claude/commands/check-ci.md',
    rule: 'ci-failure-taxonomy',
  },
];

export const MIRROR_PARITY_WORKFLOW = '.github/workflows/agent-mirror-parity.yml';

const PUSH_KEY = /^ {2}push:\s*$/;
const PATHS_KEY = /^ {4}paths:\s*$/;
const PATH_ITEM = /^ {6}-\s+(['"]?)(.+?)\1\s*$/;
const BLANK_OR_COMMENT = /^\s*(#.*)?$/;
const TRIGGER_KEY = /^ {0,2}\S/;

export function pairFiles(): string[] {
  return MIRROR_PAIRS.flatMap((pair) => [pair.source, pair.mirror]);
}

// A line-based read, not a YAML parse: the agent package carries no YAML dependency. The search stops at the next
// trigger, so a paths list under pull_request cannot stand in for a push block that lost its own.
export function parseWorkflowPushPaths(workflow: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const pushAt = lines.findIndex((line) => PUSH_KEY.test(line));
  let pathsAt = -1;
  for (let index = pushAt + 1; pushAt !== -1 && index < lines.length; index += 1) {
    const line = lines[index];
    if (PATHS_KEY.test(line)) {
      pathsAt = index;
      break;
    }
    if (!BLANK_OR_COMMENT.test(line) && TRIGGER_KEY.test(line)) break;
  }
  if (pathsAt === -1) throw new Error('workflow has no push.paths list');
  const paths: string[] = [];
  for (const line of lines.slice(pathsAt + 1)) {
    const item = PATH_ITEM.exec(line);
    if (item === null) {
      if (BLANK_OR_COMMENT.test(line)) continue;
      break;
    }
    paths.push(item[2]);
  }
  return paths;
}

export function assertWorkflowPathsMatch(ruleRoot: string): void {
  const listed = parseWorkflowPushPaths(readFileSync(join(ruleRoot, MIRROR_PARITY_WORKFLOW), 'utf8'));
  const expected = pairFiles();
  const missing = expected.filter((file) => !listed.includes(file));
  const extra = listed.filter((file) => !expected.includes(file));
  if (missing.length > 0 || extra.length > 0 || new Set(listed).size !== listed.length) {
    throw new Error(
      `${MIRROR_PARITY_WORKFLOW} push.paths does not match pairs.ts (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
    );
  }
}

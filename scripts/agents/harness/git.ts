import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { SHA_PATTERN } from './tracked-files.ts';

const GIT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const ALL_ZEROS = /^0+$/;
const FENCE_ID_BYTES = 8;
// Pinned so git config cannot run diff or textconv programs or change the format the diff readers parse.
export const PINNED_DIFF_OPTIONS: readonly string[] = [
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--no-renames',
  '--src-prefix=a/',
  '--dst-prefix=b/',
];

export function git(repoRoot: string, args: readonly string[], env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd: repoRoot,
    env: env === undefined ? undefined : { ...process.env, ...env },
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function revParseCommit(repoRoot: string, rev: string): string | undefined {
  try {
    return git(repoRoot, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim() || undefined;
  } catch {
    return undefined;
  }
}

export function resolveSha(repoRoot: string, sha: string): string {
  if (!SHA_PATTERN.test(sha)) throw new Error('--sha must be a hex commit id of 7 to 64 characters');
  const resolved = revParseCommit(repoRoot, sha);
  if (resolved === undefined) throw new Error(`commit not found: ${sha}`);
  return resolved;
}

export function resolveBase(repoRoot: string, sha: string, base: string | undefined): string {
  const parentRev = `${sha}^`;
  const requested = base === undefined || base === '' || ALL_ZEROS.test(base) ? parentRev : base;
  if (requested !== parentRev && !SHA_PATTERN.test(requested)) {
    throw new Error('--base must be a hex commit id');
  }
  const resolved = revParseCommit(repoRoot, requested);
  if (resolved !== undefined) return resolved;
  if (requested === parentRev) return EMPTY_TREE;
  throw new Error(`base commit not found: ${requested}`);
}

// A shallow clone keeps the parent line in the commit object without the parent itself, so sha^ fails to resolve
// there exactly as it does for a root commit. Only the header is read: a message line may also start with "parent ".
export function isRootCommit(repoRoot: string, sha: string): boolean {
  const header = git(repoRoot, ['cat-file', 'commit', sha]).split('\n\n', 1)[0];
  return !/^parent /m.test(header);
}

export function fenceUntrusted(label: string, text: string): string {
  const id = randomBytes(FENCE_ID_BYTES).toString('hex');
  return `<<<UNTRUSTED-DATA id=${id} label=${label}>>>\n${text}\n<<<END-UNTRUSTED-DATA id=${id}>>>`;
}

export function textResult(text: string, isError = false): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  return isError ? { content: [{ type: 'text', text }], isError } : { content: [{ type: 'text', text }] };
}

export function repoToplevel(cwd: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
}

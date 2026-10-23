import { execFileSync } from 'node:child_process';
import { MAX_FILE_CHARS } from './limits.ts';
import type { ToolError } from './types.ts';

const GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;
export const SHA_PATTERN = /^[0-9a-fA-F]{7,64}$/;
const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;
const ENV_BASENAME_PATTERN = /^\.env/;
const AUTH_STATE_SEGMENT = '.auth';
const BACKSLASH = '\\';

export interface LineRange {
  startLine?: number;
  endLine?: number;
}

export interface TrackedFileRead {
  ok: true;
  path: string;
  content: string;
  totalLines: number;
  truncated: boolean;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function hasAuthStateSegment(path: string): boolean {
  return path.split('/').includes(AUTH_STATE_SEGMENT);
}

function deny(error: string): ToolError {
  return { ok: false, error };
}

export function listTrackedFiles(repoRoot: string, prefixes: readonly string[]): ReadonlySet<string> {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
  });
  const tracked = output
    .split('\0')
    .filter((path) => path !== '')
    .filter((path) => prefixes.some((prefix) => path.startsWith(prefix)))
    .filter((path) => !ENV_BASENAME_PATTERN.test(basename(path)))
    .filter((path) => !hasAuthStateSegment(path));
  return new Set(tracked);
}

function validateRequestedPath(requested: string, allowed: ReadonlySet<string>): ToolError | undefined {
  if (requested.includes('\0')) return deny('path contains a NUL byte');
  if (requested.includes(BACKSLASH)) return deny('path must use forward slashes');
  if (requested.startsWith('/') || WINDOWS_DRIVE_PATTERN.test(requested)) {
    return deny('absolute paths are not allowed');
  }
  if (requested.split('/').includes('..')) return deny('path traversal is not allowed');
  if (ENV_BASENAME_PATTERN.test(basename(requested))) return deny('environment files are not readable');
  if (hasAuthStateSegment(requested)) return deny('auth state files are not readable');
  if (!allowed.has(requested)) return deny('path is not an allowed tracked file');
  return undefined;
}

function validateRange(range: LineRange | undefined): ToolError | undefined {
  if (range === undefined) return undefined;
  const { startLine, endLine } = range;
  for (const line of [startLine, endLine]) {
    if (line !== undefined && (!Number.isInteger(line) || line < 1)) {
      return deny('line numbers must be positive integers');
    }
  }
  if (startLine !== undefined && endLine !== undefined && startLine > endLine) {
    return deny('startLine must not exceed endLine');
  }
  return undefined;
}

export function readTrackedFile(
  repoRoot: string,
  allowed: ReadonlySet<string>,
  sha: string,
  requested: string,
  range?: LineRange,
): TrackedFileRead | ToolError {
  if (!SHA_PATTERN.test(sha)) return deny('invalid commit sha');
  const pathError = validateRequestedPath(requested, allowed);
  if (pathError) return pathError;
  const rangeError = validateRange(range);
  if (rangeError) return rangeError;

  let raw: string;
  try {
    raw = execFileSync('git', ['show', `${sha}:${requested}`], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return deny('file not found at the requested commit');
  }

  const lines = raw.split('\n');
  const start = range?.startLine ?? 1;
  const end = Math.min(range?.endLine ?? lines.length, lines.length);
  const numbered = lines
    .slice(start - 1, end)
    .map((line, offset) => `${start + offset}: ${line}`)
    .join('\n');
  const truncated = numbered.length > MAX_FILE_CHARS;
  return {
    ok: true,
    path: requested,
    content: truncated ? numbered.slice(0, MAX_FILE_CHARS) : numbered,
    totalLines: lines.length,
    truncated,
  };
}

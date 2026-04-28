#!/usr/bin/env node
'use strict';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch (_) { process.exit(0); }

  const cmd = ((input.tool_input || {}).command || '').trim();
  if (!cmd) process.exit(0);

  const reason = evaluate(cmd);
  if (reason) process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
});

// ── CATEGORY 1: Destructive (always block) ───────────────────────────────────
const DESTRUCTIVE = [
  {
    // rm -rf / rm -fr / rm -rfi (combined short flags, any order)
    re: /\brm\s+(?=\S*-[a-zA-Z]*r[a-zA-Z]*)(?=\S*-[a-zA-Z]*f[a-zA-Z]*)-\S+/i,
    msg: 'BLOCKED: "rm -rf" is irreversible.\n'
       + 'Safe alternatives:\n'
       + '  • npm run clean          (rimraf on build artefacts)\n'
       + '  • npx rimraf <path>      (targeted removal)\n'
       + '  • mv <dir> /tmp/backup   (reversible move)',
  },
  {
    // rm --recursive --force (GNU long flags, any order)
    re: /\brm\b.*--recursive.*--force|\brm\b.*--force.*--recursive/i,
    msg: 'BLOCKED: "rm --recursive --force" is irreversible.\n'
       + 'Use "npm run clean" or "npx rimraf <path>" instead.',
  },
  {
    // PowerShell Remove-Item -Recurse -Force
    re: /Remove-Item\b.*-Recurse.*-Force|Remove-Item\b.*-Force.*-Recurse/i,
    msg: 'BLOCKED: "Remove-Item -Recurse -Force" is irreversible.\n'
       + 'Use "npm run clean" or rimraf instead.',
  },
  {
    // git push (any remote, including --force)
    re: /\bgit\s+push\b/i,
    msg: 'BLOCKED: "git push" could overwrite remote history or trigger CI.\n'
       + 'Review changes first:\n'
       + '  • git log --oneline -10\n'
       + '  • git diff HEAD~1\n'
       + 'Push manually from your terminal when ready.',
  },
  {
    // npm publish
    re: /\bnpm\s+(?:run\s+)?publish\b/i,
    msg: 'BLOCKED: "npm publish" releases to the public registry.\n'
       + 'Execute manually after a full release review.',
  },
  {
    // docker system prune (any flags: -a -f --all --volumes)
    re: /\bdocker\s+system\s+prune\b/i,
    msg: 'BLOCKED: "docker system prune" deletes ALL unused images, containers, networks, and volumes.\n'
       + 'Use targeted commands instead:\n'
       + '  • docker container prune\n'
       + '  • docker image prune\n'
       + '  • docker volume prune',
  },
  {
    // SQL: DELETE FROM
    re: /\bDELETE\s+FROM\b/i,
    msg: 'BLOCKED: "DELETE FROM" can permanently destroy table data.\n'
       + 'Add a WHERE clause and run manually. For test cleanup use seed/teardown scripts.',
  },
  {
    // SQL: DROP TABLE
    re: /\bDROP\s+TABLE\b/i,
    msg: 'BLOCKED: "DROP TABLE" permanently removes a table and all its data.\n'
       + 'Use migration scripts via your DB migration tool.',
  },
  {
    // SQL: DROP DATABASE
    re: /\bDROP\s+DATABASE\b/i,
    msg: 'BLOCKED: "DROP DATABASE" destroys an entire database.\n'
       + 'Use migration scripts via your DB migration tool.',
  },
  {
    // SQL: TRUNCATE TABLE
    re: /\bTRUNCATE\s+TABLE\b/i,
    msg: 'BLOCKED: "TRUNCATE TABLE" removes all rows and cannot be rolled back in most DBs.\n'
       + 'Use targeted DELETE with WHERE, or application teardown scripts.',
  },
  {
    // git reset --hard
    re: /\bgit\s+reset\b.*--hard\b/i,
    msg: 'BLOCKED: "git reset --hard" discards all uncommitted changes permanently.\n'
       + 'Safe alternatives:\n'
       + '  • git stash           (save temporarily)\n'
       + '  • git diff HEAD       (preview what is lost)\n'
       + '  • git reset --soft    (move HEAD, keep working tree)',
  },
  {
    // git clean -f / -fd / -fx (not -n dry-run)
    re: /\bgit\s+clean\b(?=.*-[a-zA-Z]*f)/i,
    msg: 'BLOCKED: "git clean -f" permanently deletes untracked files.\n'
       + 'Run "git clean -n" first to preview, then execute manually.',
  },
];

// ── CATEGORY 2: Costly (framework-specific) ──────────────────────────────────
const COSTLY = [
  {
    re: /percy\s+exec\b|\btest:percy(?::[a-zA-Z:]+)?\b/i,
    msg: 'BLOCKED: Percy visual tests consume billable snapshot credits.\n'
       + 'Run a targeted spec locally first:\n'
       + '  • npm run test:simple\n'
       + '  • npx playwright test <file>\n'
       + 'Trigger Percy only in CI on an approved branch.',
  },
  {
    re: /\blhci\s+(?:collect|upload|run|assert)\b|\bnpm\s+run\s+lhci\b|\blhci:(?:run|collect|upload|assert)\b/i,
    msg: 'BLOCKED: Lighthouse CI (lhci) uploads results to a remote server and costs CI minutes.\n'
       + 'Run Lighthouse locally instead:\n'
       + '  • npx lighthouse <url> --output html --view\n'
       + 'Trigger lhci only in designated CI pipeline stages.',
  },
  {
    re: /\bdocker(?:-compose)?\s+build\b|\bnpm\s+run\s+docker:(?:build|rebuild)\b|\bdocker:(?:build|rebuild)\b/i,
    msg: 'BLOCKED: Docker image builds take 5–15+ minutes and consume significant CPU/disk.\n'
       + 'Check existing images first:\n'
       + '  • docker images\n'
       + '  • npm run docker:test          (use pre-built image)\n'
       + 'Only rebuild after a Dockerfile or dependency change.',
  },
  {
    re: /\bnpm\s+run\s+docker:test:parallel\b|\bdocker:test:parallel\b/i,
    msg: 'BLOCKED: docker:test:parallel runs chromium + firefox + webkit containers simultaneously (6–8 GB+ RAM).\n'
       + 'Run one browser first:\n'
       + '  • npm run docker:test:chromium\n'
       + '  • npm run docker:test:firefox\n'
       + 'Use docker:test:parallel only in a dedicated CI job.',
  },
  {
    re: /docker-compose\s+up\b.*playwright/i,
    msg: 'BLOCKED: Starting multiple Playwright Docker containers simultaneously is resource-intensive.\n'
       + 'Use a single-browser docker run:\n'
       + '  • npm run docker:test:chromium',
  },
  {
    re: /WORKERS=100%|\bnpm\s+run\s+test:parallel:(?:max|all)\b|\btest:parallel:(?:max|all)\b/i,
    msg: 'BLOCKED: WORKERS=100% saturates all CPU cores and causes flaky results on dev machines.\n'
       + 'Use a capped worker count:\n'
       + '  • npm run test:parallel          (50% workers)\n'
       + '  • npx playwright test --workers=4\n'
       + 'Reserve 100% workers for dedicated CI machines.',
  },
  {
    re: /NODE_ENV=production\s+npm\b|\bnpm\s+run\s+test:production\b|\btest:production\b/i,
    msg: 'BLOCKED: Tests against NODE_ENV=production target the live environment and risk real side effects.\n'
       + 'Use testing or staging instead:\n'
       + '  • npm run test:testing\n'
       + '  • npm run test:staging\n'
       + 'Production runs must be approved and executed manually.',
  },
];

function evaluate(cmd) {
  for (const rule of DESTRUCTIVE) {
    if (rule.re.test(cmd)) return rule.msg;
  }
  for (const rule of COSTLY) {
    if (rule.re.test(cmd)) return rule.msg;
  }
  return null;
}

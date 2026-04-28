'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const prompt = (input.prompt || '').trim();
  const cwd = input.cwd || process.cwd();

  const codingIntentRe = /\b(write|create|add|implement|generate|fix)\b/i;
  const existingSpecRe = /[\w\-./]+\.spec\.ts/i;

  // Jira URL always wins — unambiguous signal regardless of document presence
  const JIRA_URL_RE =
    /https?:\/\/[\w.-]+\.atlassian\.net\/browse\/([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)/i;

  // Bare ticket: 2-segment only (PROJECT-123).
  // Multi-segment IDs like E2E-SRCH-001 or E2E-NAV-009 are document section refs, not Jira tickets.
  const JIRA_BARE_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/;

  const hasCodingIntent = codingIntentRe.test(prompt);
  const hasExistingSpec = existingSpecRe.test(prompt);

  const jiraUrlMatch = JIRA_URL_RE.exec(prompt);
  const jiraBareMatch = !jiraUrlMatch ? JIRA_BARE_RE.exec(prompt) : null;
  const jiraFromUrl = jiraUrlMatch?.[1] ?? null;
  const jiraFromBare = jiraBareMatch?.[1] ?? null;

  const sections = [];

  // Step 1 — Always: live git state + last test run
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  const log = git(['log', '--oneline', '-3'], cwd);
  const statusOut = git(['status', '--short'], cwd);
  const dirtyCount = statusOut ? statusOut.split('\n').filter(l => l.trim()).length : 0;

  let liveState = '## Live Project State\n';
  liveState += `- Branch: ${branch || 'unknown'}\n`;
  if (log) liveState += `- Recent commits:\n${log.split('\n').map(l => `  ${l}`).join('\n')}\n`;
  liveState += `- Changed files: ${dirtyCount}\n`;

  const summaryFile = path.join(cwd, 'test-summary.txt');
  if (fs.existsSync(summaryFile)) {
    try {
      const lines = fs.readFileSync(summaryFile, 'utf8').trim().split('\n').slice(0, 5);
      liveState += `- Last test run:\n${lines.map(l => `  ${l}`).join('\n')}\n`;
    } catch {}
  }
  sections.push(liveState);

  // Step 2 — Coding intent: inject compact ruleset
  if (hasCodingIntent) {
    sections.push(`## Active Rules
QA RULES:
- Tag tests: @smoke, @regression, @critical in test.describe() name string
- Never hardcode test data — use src/data/ modules
- Each test must be independently runnable (no shared state between tests)
- Use page.getByRole() / page.getByText() over raw CSS selectors (CSS only for StyleHelper)

CODING STANDARDS:
- Import from @config/base-test, never from @playwright/test directly
- Extend BasePage — never call page.locator() or page.click() directly in page classes
- Use TIMEOUTS constants from src/constants/timeouts.ts — never magic numbers
- No comments unless the WHY is non-obvious

PLAYWRIGHT RULES:
- Locator priority: getByRole > getByLabel > getByText > CSS
- Retries only for network-dependent steps, not UI assertions
- Register every new page object as a fixture in src/config/base-test.ts`);
  }

  // Step 3 — Intelligent routing (no blocking)
  const routingSection = buildRoutingSection(prompt, cwd, jiraFromUrl, jiraFromBare, hasExistingSpec);
  if (routingSection) sections.push(routingSection);

  // Step 4 — Emit context + session title
  emit({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: sections.join('\n\n'),
      sessionTitle: toTitle(prompt),
    },
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

const ROUTING_RULES = [
  {
    type: 'agent',
    name: 'devops-cicd-specialist',
    reason: 'CI/CD or pipeline failure investigation detected',
    keywords: [
      '\\bCI\\b',
      'pipeline',
      'build fail',
      'github actions',
      'red build',
      'circleci',
      'yml workflow',
      'bitbucket pipeline',
      'deployment',
    ],
  },
  {
    type: 'agent',
    name: 'playwright-test-healer',
    reason: 'failing or broken test detected — needs diagnosis and repair',
    keywords: ['\\bfix\\b', 'broken', 'failing', 'flaky', '\\bdebug\\b', 'heal', 'not passing', 'test fail'],
  },
  {
    type: 'agent',
    name: 'qa-code-reviewer',
    reason: 'code review or audit requested',
    keywords: ['\\breview\\b', '\\baudit\\b', 'quality check', 'code review', 'before merge', 'check this file', 'check my test'],
  },
  {
    type: 'agent',
    name: 'playwright-test-planner',
    reason: 'test planning or coverage exploration requested',
    keywords: ['\\bplan\\b', '\\bexplore\\b', 'discover', 'map flow', 'what to test', 'test coverage for', 'no tests yet', 'from scratch'],
  },
  {
    type: 'agent',
    name: 'playwright-test-generator',
    reason: 'browser recording or codegen requested',
    keywords: ['\\brecord\\b', 'codegen', 'watch me', 'capture from browser', 'record this flow'],
  },
  {
    type: 'agent',
    name: 'qa-orchestrator',
    reason: 'test creation or automation task detected',
    keywords: ['write test', 'create test', '\\bautomate\\b', 'generate test', 'write spec', 'create spec', 'add test', 'implement test'],
  },
  {
    type: 'skill',
    name: '/accessibility',
    reason: 'accessibility or WCAG concern detected',
    keywords: ['\\ba11y\\b', 'accessibility', 'wcag', '\\baria\\b', 'screen reader', 'keyboard nav'],
  },
  {
    type: 'skill',
    name: '/api-mocking',
    reason: 'API mocking or request interception detected',
    keywords: ['\\bmock\\b', 'intercept', 'route request', 'stub api', 'api mock', 'network mock'],
  },
  {
    type: 'skill',
    name: '/graphql-testing',
    reason: 'GraphQL query or mutation testing detected',
    keywords: ['graphql', '\\bgql\\b'],
  },
  {
    type: 'skill',
    name: '/ts-strict-mode',
    reason: 'TypeScript strict mode patterns requested',
    keywords: ['strict mode', 'typescript strict', 'no any', 'strict null'],
  },
  {
    type: 'skill',
    name: '/playwright-best-practices',
    reason: 'architecture or pattern review requested',
    keywords: ['architecture review', 'pattern review', 'best practice', 'pom pattern'],
  },
  {
    type: 'skill',
    name: '/playwright-expert',
    reason: 'Playwright API guidance requested',
    keywords: ['page object', '\\blocator\\b', '\\bfixture\\b', 'base-test', '\\bselector\\b'],
  },
  {
    type: 'skill',
    name: '/seo',
    reason: 'SEO or structured data concern detected',
    keywords: ['\\bseo\\b', 'meta tag', 'structured data', '\\bsitemap\\b'],
  },
  {
    type: 'skill',
    name: '/cicd-pipeline',
    reason: 'CI/CD pipeline configuration requested',
    keywords: ['pipeline config', 'cache artifact', 'parallel test'],
  },
  {
    type: 'skill',
    name: '/test-case-generator',
    reason: 'test case generation from specs or user stories detected',
    keywords: ['generate test case', 'test cases from', 'user story to test'],
  },
  {
    type: 'skill',
    name: '/documentation-writer',
    reason: 'documentation generation requested',
    keywords: ['write docs', 'jsdoc', '\\breadme\\b', 'generate documentation', 'documentation'],
  },
  {
    type: 'skill',
    name: '/error-debugger',
    reason: 'error, exception, or crash detected',
    keywords: ['\\berror\\b', 'exception', 'stack trace', '\\bcrash\\b'],
  },
];

function resolveRoutingTarget(prompt) {
  for (const rule of ROUTING_RULES) {
    for (const kw of rule.keywords) {
      if (new RegExp(kw, 'i').test(prompt)) {
        return { type: rule.type, name: rule.name, reason: rule.reason };
      }
    }
  }
  return { type: 'fallback', name: null, reason: 'No specific skill or agent matched.' };
}

function buildDocumentRoutingSection(docPath) {
  const docName = path.basename(docPath);
  return (
    `## Referenced Document\n` +
    `Document **${docName}** was referenced as the source for this request.\n` +
    `Delegate to the **qa-orchestrator** agent. Instruct it to:\n` +
    `1. Read the document at \`${docPath}\`\n` +
    `2. Use it as the source of test scenarios and acceptance criteria\n` +
    `3. Run the full plan → build → review pipeline`
  );
}

function buildRoutingSection(prompt, cwd, jiraFromUrl, jiraFromBare, hasExistingSpec) {
  // 1. Document detection (skip if prompt already references a spec file)
  let planResult = { found: false, isPlan: false, docPath: null };
  if (!hasExistingSpec) {
    planResult = findPlan(cwd, prompt, jiraFromUrl ?? jiraFromBare);
  }

  // 2. Resolve Jira ticket — bare ID is suppressed when a document is found
  //    (the ID is a section reference inside that document, not a Jira ticket)
  const jiraTicket = jiraFromUrl ?? (planResult.found ? null : jiraFromBare);
  const hasJira = jiraTicket !== null;

  // 3. Non-plan document found → document routing wins over everything else
  if (planResult.found && !planResult.isPlan) {
    return buildDocumentRoutingSection(planResult.docPath);
  }

  // 4. Resolve routing target
  const target = resolveRoutingTarget(prompt);

  const parts = [];

  // 5. Jira enrichment block (only when a real Jira ticket is confirmed)
  if (hasJira) {
    parts.push(
      `## Jira Enrichment\n` +
        `Ticket **${jiraTicket}** was detected.\n` +
        `Use \`mcp__atlassian__getJiraIssue\` with \`issueIdOrKey: "${jiraTicket}"\`.\n` +
        `Extract: summary, description, acceptance criteria, labels, linked issues.`
    );
  }

  // 6. Routing instruction block
  if (target.type === 'fallback') {
    parts.push(
      `## Routing Instruction\n` +
        `No specific skill or agent matched this prompt.\n` +
        `Consider entering **plan mode** first: explore the codebase, understand the existing structure,\n` +
        `then identify the correct approach. Useful starting points: invoke \`playwright-test-planner\`\n` +
        `to map the feature area, or ask which skill best fits your goal.`
    );
  } else {
    const invokeKind = target.type === 'agent' ? 'agent' : 'skill';
    let routingText =
      `## Routing Instruction\n` +
      `Invoke the **${target.name}** ${invokeKind} — ${target.reason}.`;
    if (hasJira) {
      routingText += `\nIncorporate the Jira context from **${jiraTicket}** when planning or building.`;
    }
    parts.push(routingText);
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Helpers (unchanged)
// ---------------------------------------------------------------------------

function git(args, cwd) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 5000 });
    return (r.stdout || '').trim();
  } catch {
    return '';
  }
}

// DOC_EXTS covers all common document/spreadsheet/data formats that may contain test specs
const DOC_EXTS = ['.md', '.txt', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'];

// Directories to probe when resolving bare filenames (relative to cwd)
const DOC_DIRS = ['', 'Guideline', 'docs', 'documentation', 'specs', '.claude/plans'];

function findPlan(cwd, prompt, jiraTicket) {
  // 1. Explicit references with a recognised document extension
  const docExtRe = new RegExp(`[\\w\\-./]+\\.(${DOC_EXTS.map(e => e.slice(1)).join('|')})\\b`, 'gi');
  for (const ref of prompt.match(docExtRe) || []) {
    const result = resolveDocPath(cwd, ref);
    if (result) return result;
  }

  // 2. Bare names — ALL_CAPS_WITH_UNDERSCORE identifiers (e.g. E2E_DISCOVERY_REPORT)
  //    Must contain at least one underscore to avoid matching short acronyms.
  const bareNameRe = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g;
  let m;
  while ((m = bareNameRe.exec(prompt)) !== null) {
    for (const dir of DOC_DIRS) {
      for (const ext of DOC_EXTS) {
        const filePath = path.join(cwd, dir, m[1] + ext);
        if (fs.existsSync(filePath)) {
          return { found: true, isPlan: isInPlansDir(cwd, filePath), docPath: filePath };
        }
      }
    }
  }

  // 3. Scan .claude/plans/ for filename or Jira ID matches
  const plansDir = path.join(cwd, '.claude', 'plans');
  if (!fs.existsSync(plansDir)) return { found: false, isPlan: false, docPath: null };

  let files;
  try {
    files = fs.readdirSync(plansDir).filter(f => f.endsWith('.md'));
  } catch {
    return { found: false, isPlan: false, docPath: null };
  }

  for (const f of files) {
    if (prompt.includes(f) || prompt.includes(f.replace(/\.md$/, ''))) {
      return { found: true, isPlan: true, docPath: path.join(plansDir, f) };
    }
  }

  if (jiraTicket) {
    for (const f of files) {
      try {
        if (fs.readFileSync(path.join(plansDir, f), 'utf8').includes(jiraTicket)) {
          return { found: true, isPlan: true, docPath: path.join(plansDir, f) };
        }
      } catch {}
    }
  }

  return { found: false, isPlan: false, docPath: null };
}

function resolveDocPath(cwd, ref) {
  const resolved = path.isAbsolute(ref) ? ref : path.join(cwd, ref);
  if (fs.existsSync(resolved)) {
    return { found: true, isPlan: isInPlansDir(cwd, resolved), docPath: resolved };
  }
  // Also check directly inside .claude/plans/
  const inPlans = path.join(cwd, '.claude', 'plans', path.basename(ref));
  if (fs.existsSync(inPlans)) {
    return { found: true, isPlan: true, docPath: inPlans };
  }
  return null;
}

function isInPlansDir(cwd, filePath) {
  const plansDir = path.normalize(path.join(cwd, '.claude', 'plans'));
  return path.normalize(filePath).startsWith(plansDir);
}

function toTitle(prompt) {
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 50);
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

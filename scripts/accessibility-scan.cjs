const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;

const TARGET_URL = 'https://stag-platypus-au.accentgra.com/';
const OUTPUT_DIR = path.resolve(process.cwd(), 'accessibility-report');
const TAGS = ['wcag21aa', 'cat.color', 'cat.aria', 'cat.forms', 'cat.keyboard'];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMarkdownReport(results) {
  const lines = [];
  lines.push('# Accessibility Scan Report');
  lines.push('');
  lines.push(`- URL: ${TARGET_URL}`);
  lines.push(`- Standard/Scope: WCAG 2.1 AA + category filters (${TAGS.join(', ')})`);
  lines.push(`- Scan time (UTC): ${new Date().toISOString()}`);
  lines.push(`- Violations: ${results.violations.length}`);
  lines.push(`- Passes: ${results.passes.length}`);
  lines.push(`- Incomplete: ${results.incomplete.length}`);
  lines.push('');

  if (results.violations.length === 0) {
    lines.push('## Findings');
    lines.push('No violations were detected for the selected tags.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Findings');
  lines.push('');

  results.violations.forEach((violation, index) => {
    lines.push(`### ${index + 1}. ${violation.id}`);
    lines.push(`- Impact: ${violation.impact || 'n/a'}`);
    lines.push(`- Help: ${violation.help}`);
    lines.push(`- Description: ${violation.description}`);
    lines.push(`- Affected nodes: ${violation.nodes.length}`);
    lines.push(`- Tags: ${violation.tags.join(', ')}`);
    lines.push(`- Help URL: ${violation.helpUrl}`);
    lines.push('');

    violation.nodes.slice(0, 3).forEach((node, nodeIndex) => {
      lines.push(`  - Node ${nodeIndex + 1}`);
      lines.push(`    - Target: ${node.target.join(', ')}`);
      lines.push(`    - Failure: ${(node.failureSummary || 'n/a').replace(/\n/g, ' ')}`);
    });
    lines.push('');
  });

  return lines.join('\n');
}

function buildHtmlReport(results) {
  const issueRows = results.violations
    .map((v, i) => {
      const targets = v.nodes
        .slice(0, 3)
        .map((n) => `<li><code>${escapeHtml(n.target.join(', '))}</code></li>`)
        .join('');
      return `
      <article class="card">
        <h3>${i + 1}. ${escapeHtml(v.id)}</h3>
        <p><strong>Impact:</strong> ${escapeHtml(v.impact || 'n/a')}</p>
        <p><strong>Help:</strong> ${escapeHtml(v.help)}</p>
        <p><strong>Description:</strong> ${escapeHtml(v.description)}</p>
        <p><strong>Affected nodes:</strong> ${v.nodes.length}</p>
        <p><strong>Help URL:</strong> <a href="${escapeHtml(v.helpUrl)}">${escapeHtml(v.helpUrl)}</a></p>
        <p><strong>Example targets:</strong></p>
        <ul>${targets || '<li>n/a</li>'}</ul>
      </article>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Accessibility Scan Results</title>
    <style>
      body { font-family: Georgia, 'Times New Roman', serif; margin: 24px; background: #f7f6f3; color: #1f2a37; }
      .header { background: #0b3d2e; color: #f8fafc; padding: 18px 20px; border-radius: 10px; }
      .meta { margin-top: 14px; display: grid; gap: 8px; }
      .grid { margin-top: 18px; display: grid; gap: 14px; }
      .card { background: #ffffff; border: 1px solid #d1d5db; border-left: 6px solid #b45309; border-radius: 8px; padding: 14px; }
      code { background: #f3f4f6; padding: 2px 5px; border-radius: 4px; }
      a { color: #0c4a6e; }
    </style>
  </head>
  <body>
    <section class="header">
      <h1>Accessibility Scan Report</h1>
      <div class="meta">
        <div><strong>URL:</strong> ${escapeHtml(TARGET_URL)}</div>
        <div><strong>Scope:</strong> ${escapeHtml(TAGS.join(', '))}</div>
        <div><strong>Scan time (UTC):</strong> ${escapeHtml(new Date().toISOString())}</div>
        <div><strong>Violations:</strong> ${results.violations.length}</div>
      </div>
    </section>
    <section class="grid">
      ${issueRows || '<article class="card"><p>No violations detected for selected tags.</p></article>'}
    </section>
  </body>
</html>`;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'target-page.png'),
      fullPage: true,
    });

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    fs.writeFileSync(path.join(OUTPUT_DIR, 'raw-results.json'), JSON.stringify(results, null, 2), 'utf8');

    const markdown = buildMarkdownReport(results);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), markdown, 'utf8');

    const html = buildHtmlReport(results);
    const htmlPath = path.join(OUTPUT_DIR, 'report.html');
    fs.writeFileSync(htmlPath, html, 'utf8');

    const reportPage = await context.newPage();
    await reportPage.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    await reportPage.screenshot({
      path: path.join(OUTPUT_DIR, 'results-summary.png'),
      fullPage: true,
    });

    console.log(`Accessibility scan completed. Violations: ${results.violations.length}`);
    console.log(`Report: ${path.join(OUTPUT_DIR, 'report.md')}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Accessibility scan failed:', error);
  process.exitCode = 1;
});

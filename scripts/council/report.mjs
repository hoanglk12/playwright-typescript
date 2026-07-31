/**
 * scripts/council/report.mjs
 *
 * Output writers for the LLM Council multi-provider tool. Generates the
 * HTML report and markdown transcript directly — this script does NOT hand
 * data back to the Claude Code `llm-council` skill, the two tools are
 * independent artifacts.
 */
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/** YYYYMMDD-HHmmss, used in all three output filenames. */
export function ts() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureOutDir(outDir) {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
}

/**
 * Parses a `RANKING: B > D > A > E > C` line out of review text.
 * Returns an ordered array of letters, most to least convincing, or [].
 */
export function parseRanking(reviewText) {
  // Tolerant of markdown emphasis and case ("**RANKING:** B > D > A", "ranking: B>D>A") —
  // real models don't reliably reproduce the prompt's literal formatting.
  const match = /\*{0,2}RANKING\*{0,2}:\s*\*{0,2}\s*([A-Z](?:\s*>\s*[A-Z])*)/i.exec(reviewText ?? '');
  if (!match) return [];
  return match[1].split('>').map(s => s.trim().toUpperCase()).filter(Boolean);
}

/**
 * Tallies how many reviewers ranked their own (anonymized) response first.
 * Returns { k, n, details } where n = number of reviews with a parseable
 * ranking and a known reviewer→letter mapping.
 */
export function computeSelfPreference(run) {
  const letterByModel = new Map((run.anonymization ?? []).map(a => [a.model, a.letter]));
  let k = 0;
  let n = 0;
  const details = [];
  for (const review of run.reviews ?? []) {
    if (review.status !== 'ok') continue;
    const ownLetter = letterByModel.get(review.model);
    const ranking = review.ranking?.length ? review.ranking : parseRanking(review.text);
    if (!ownLetter || !ranking.length) continue;
    n++;
    const rankedSelfFirst = ranking[0] === ownLetter;
    if (rankedSelfFirst) k++;
    details.push({ reviewer: review.model, ownLetter, topPick: ranking[0], rankedSelfFirst });
  }
  return { k, n, details };
}

/** Tally of #1 rankings per model, for the alignment/divergence visual. */
function computeTopPickTally(run) {
  const modelByLetter = new Map((run.anonymization ?? []).map(a => [a.letter, a.model]));
  const tally = new Map();
  for (const review of run.reviews ?? []) {
    if (review.status !== 'ok') continue;
    const ranking = review.ranking?.length ? review.ranking : parseRanking(review.text);
    if (!ranking.length) continue;
    const topModel = modelByLetter.get(ranking[0]);
    if (!topModel) continue;
    tally.set(topModel, (tally.get(topModel) ?? 0) + 1);
  }
  return tally;
}

/**
 * Average rank position per model across all parsed peer reviews (1 = ranked
 * first). Mirrors the "aggregate rankings" list in karpathy/llm-council's
 * Stage2 UI, which this report's layout is modeled on.
 */
function computeAggregateRankings(run) {
  const modelByLetter = new Map((run.anonymization ?? []).map(a => [a.letter, a.model]));
  const totals = new Map();
  for (const review of run.reviews ?? []) {
    if (review.status !== 'ok') continue;
    const ranking = review.ranking?.length ? review.ranking : parseRanking(review.text);
    if (!ranking.length) continue;
    ranking.forEach((letter, idx) => {
      const model = modelByLetter.get(letter);
      if (!model) return;
      const entry = totals.get(model) ?? { sum: 0, count: 0 };
      entry.sum += idx + 1;
      entry.count += 1;
      totals.set(model, entry);
    });
  }
  return [...totals.entries()]
    .map(([model, { sum, count }]) => ({ model, avgRank: sum / count, votes: count }))
    .sort((a, b) => a.avgRank - b.avgRank);
}

function vendorCollisionNote(run) {
  const chairmanFamily = run.chairman.family.split(' (')[0];
  const collides = run.models.some(m => m.family.split(' (')[0] === chairmanFamily);
  if (!collides) return null;
  return (
    `Disclosure: chairman ${run.chairman.slug} shares a vendor family (${chairmanFamily}) with a ` +
    'panelist in this run. This is an accepted, disclosed tradeoff — see CLAUDE.md — not a bug.'
  );
}

/**
 * Visual layout modeled on karpathy/llm-council's frontend (React + Vite):
 * a 260px ChatGPT-style sidebar (#f8f8f8, right border #e0e0e0), a white
 * main pane with question/answer "message" blocks, per-model tab bars for
 * Stage 1 and Stage 2 (blue accent #4a90e2, active tab hides its bottom
 * border to fuse with the panel below), and a green-bordered chairman card
 * for Stage 3 (#c8e6c8 border / #2d8a2d label, copied from their Stage3.css).
 * This report has no build step, so tabs are plain vanilla JS instead of
 * React state — same zero-new-dependency approach as the rest of scripts/council/.
 */
function htmlHead(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
    color: #333;
    background: #fff;
  }
  .app { display: flex; align-items: flex-start; min-height: 100vh; }
  .sidebar {
    width: 260px; flex: 0 0 260px; background: #f8f8f8; border-right: 1px solid #e0e0e0;
    padding: 1.25rem 1rem; height: 100vh; position: sticky; top: 0; overflow-y: auto;
  }
  .sidebar h1 { font-size: 1rem; margin: 0 0 0.2rem; }
  .sidebar .run-meta { font-size: 0.75rem; color: #666; margin-bottom: 1.25rem; line-height: 1.4; word-break: break-word; }
  .nav-item { display: block; padding: 8px 10px; margin-bottom: 2px; border-radius: 6px; color: #333; text-decoration: none; font-size: 0.85rem; }
  .nav-item:hover { background: #f0f0f0; }
  .sidebar .cost-pill { margin-top: 1.25rem; padding: 8px 10px; background: #e8f0fe; border: 1px solid #4a90e2; border-radius: 6px; font-size: 0.75rem; color: #2a5a9a; }
  .main { flex: 1; min-width: 0; padding: 2rem 2.5rem 4rem; }
  .main-inner { max-width: 820px; }
  h2.section-title { font-size: 1.05rem; margin: 2rem 0 0.75rem; padding-bottom: 0.3rem; border-bottom: 1px solid #e0e0e0; scroll-margin-top: 1rem; }
  .message { margin-bottom: 1.5rem; scroll-margin-top: 1rem; }
  .message-role { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 0.4rem; }
  .message.user .message-role { color: #4a90e2; }
  .message.assistant .message-role { color: #2d8a2d; }
  .message-bubble { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem 1.25rem; white-space: pre-wrap; }
  .stage-title { font-size: 0.9rem; font-weight: 700; margin: 1.5rem 0 0.6rem; }
  .tabgroup { margin-bottom: 0.5rem; }
  .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .tab { padding: 8px 16px; background: #fff; border: 1px solid #d0d0d0; border-radius: 6px 6px 0 0; color: #666; cursor: pointer; font-size: 14px; font-family: inherit; transition: all 0.2s; }
  .tab:hover { background: #f0f0f0; color: #333; border-color: #4a90e2; }
  .tab.active { color: #4a90e2; border-color: #4a90e2; border-bottom-color: #fff; font-weight: 600; }
  .tab.failed-tab { color: #a02020; }
  .tab-panel { display: none; background: #fff; padding: 16px; border-radius: 0 6px 6px 6px; border: 1px solid #e0e0e0; margin-top: -1px; }
  .tab-panel.active { display: block; }
  .markdown-content { white-space: pre-wrap; line-height: 1.6; font-size: 0.92rem; }
  .markdown-content.failed-text { color: #a02020; white-space: normal; }
  .ranking-line { margin-top: 0.75rem; font-size: 0.8rem; color: #666; font-family: monospace; }
  .aggregate-rankings { margin: 0.75rem 0 1.5rem; background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; }
  .aggregate-rankings h4 { margin: 0 0 8px; font-size: 0.85rem; }
  .aggregate-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.85rem; }
  .aggregate-item:last-child { border-bottom: none; }
  .rank-position { font-weight: 700; color: #4a90e2; width: 1.5rem; }
  .rank-model { flex: 1; }
  .rank-score { color: #666; font-size: 0.8rem; }
  .rank-count { color: #999; font-size: 0.75rem; }
  .final-response { background: #fff; padding: 20px; border-radius: 6px; border: 1px solid #c8e6c8; margin-top: 0.5rem; }
  .final-response.failed { border-color: #f0c0c0; }
  .chairman-label { color: #2d8a2d; font-size: 12px; font-family: monospace; margin-bottom: 12px; font-weight: 600; }
  .final-response.failed .chairman-label { color: #a02020; }
  .final-text { color: #333; line-height: 1.7; font-size: 15px; white-space: pre-wrap; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.5rem; margin: 0.75rem 0; }
  .grid-cell { border: 1px solid #e0e0e0; border-radius: 6px; padding: 0.6rem; background: #fff; font-size: 0.85rem; }
  .grid-cell .count { font-weight: 700; font-size: 1.05rem; }
  table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; font-size: 0.85rem; }
  th, td { border: 1px solid #e0e0e0; padding: 0.4rem 0.6rem; text-align: left; }
  .caveat { color: #8a5a00; font-size: 0.8rem; }
  .failed { color: #a02020; }
  footer.run-footer { margin-top: 2.5rem; font-size: 0.78rem; color: #666; border-top: 1px solid #e0e0e0; padding-top: 0.8rem; }
  @media (max-width: 720px) {
    .app { flex-direction: column; }
    .sidebar { width: 100%; height: auto; position: static; border-right: none; border-bottom: 1px solid #e0e0e0; }
    .main { padding: 1.25rem; }
  }
</style>
</head>
<body>`;
}

function htmlFoot() {
  return `<script>
document.querySelectorAll('.tabgroup').forEach(function (group) {
  var tabs = group.querySelectorAll('.tab');
  var panels = group.querySelectorAll('.tab-panel');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = group.querySelector('#' + tab.dataset.panel);
      if (panel) panel.classList.add('active');
    });
  });
});
</script>
</body>
</html>
`;
}

function renderTabGroup(idPrefix, tabs) {
  const tabButtons = tabs
    .map(
      (t, i) =>
        `<button type="button" class="tab${i === 0 ? ' active' : ''}${t.failed ? ' failed-tab' : ''}" data-panel="${idPrefix}-panel-${i}">${escapeHtml(t.label)}</button>`
    )
    .join('\n');
  const panels = tabs
    .map((t, i) => `<div class="tab-panel${i === 0 ? ' active' : ''}" id="${idPrefix}-panel-${i}">${t.body}</div>`)
    .join('\n');
  return `<div class="tabgroup"><div class="tabs">${tabButtons}</div>${panels}</div>`;
}

/** Writes council-report-<timestamp>.html into outDir. `timestamp` defaults to ts(); pass one
 *  explicitly (as index.mjs does) so a single run produces three filenames with the same stamp. */
export function writeHtmlReport(run, outDir, timestamp = ts()) {
  ensureOutDir(outDir);
  const filename = `council-report-${timestamp}.html`;
  const filepath = join(outDir, filename);

  const topPickTally = computeTopPickTally(run);
  const selfPref = computeSelfPreference(run);
  const collisionNote = vendorCollisionNote(run);
  const aggregateRankings = computeAggregateRankings(run);

  const navItems = [
    ['#question', 'Question'],
    ['#stage1', 'Stage 1 · Independent Opinions'],
    ['#stage2', 'Stage 2 · Peer Review'],
    ['#stage3', 'Stage 3 · Chairman Verdict'],
    ['#alignment', 'Alignment / Divergence'],
    ['#metadata', 'Cost & Metadata'],
  ]
    .map(([href, label]) => `<a class="nav-item" href="${href}">${escapeHtml(label)}</a>`)
    .join('\n');

  const gridCells = run.models
    .map(m => {
      const count = topPickTally.get(m.slug) ?? 0;
      const status = run.opinions.find(o => o.model === m.slug)?.status ?? 'unknown';
      return `<div class="grid-cell"><div>${escapeHtml(m.slug)}</div><div class="count">${count} #1 vote(s)</div><div>${status === 'failed' ? '<span class="failed">failed</span>' : status}</div></div>`;
    })
    .join('\n');

  const opinionTabs = run.opinions.map(o => {
    const personaLabel = o.persona ? ` (${o.persona})` : '';
    const body = o.status === 'ok'
      ? `<div class="markdown-content">${escapeHtml(o.text)}</div>`
      : `<div class="markdown-content failed-text">Failed: ${escapeHtml(o.error ?? 'unknown error')}</div>`;
    return { label: `${o.model}${personaLabel}`, body, failed: o.status !== 'ok' };
  });

  const letterMapRows = (run.anonymization ?? [])
    .map(a => `<tr><td>${escapeHtml(a.letter)}</td><td>${escapeHtml(a.model)}</td></tr>`)
    .join('\n');

  const reviewTabs = run.reviews.map(r => {
    const rankingLine = r.status === 'ok'
      ? (() => {
          const ranking = r.ranking?.length ? r.ranking : parseRanking(r.text);
          return ranking.length ? `<div class="ranking-line">Extracted ranking: ${ranking.map(escapeHtml).join(' &gt; ')}</div>` : '';
        })()
      : '';
    const body = r.status === 'ok'
      ? `<div class="markdown-content">${escapeHtml(r.text)}</div>${rankingLine}`
      : `<div class="markdown-content failed-text">Failed: ${escapeHtml(r.error ?? 'unknown error')}</div>`;
    return { label: `${r.model} (was Response ${r.letter ?? '?'})`, body, failed: r.status !== 'ok' };
  });

  const aggregateRows = aggregateRankings
    .map(
      (a, i) =>
        `<div class="aggregate-item"><span class="rank-position">#${i + 1}</span><span class="rank-model">${escapeHtml(a.model)}</span><span class="rank-score">avg rank ${a.avgRank.toFixed(2)}</span><span class="rank-count">${a.votes} vote(s)</span></div>`
    )
    .join('\n');

  const failureRows = (run.failures ?? [])
    .map(f => `<tr><td>${escapeHtml(f.model)}</td><td>${escapeHtml(f.stage)}</td><td>${escapeHtml(f.message)}</td></tr>`)
    .join('\n');

  const costRows = [...run.opinions, ...run.reviews, run.chairmanResult]
    .filter(Boolean)
    .map(
      c =>
        `<tr><td>${escapeHtml(c.model)}</td><td>${c.status}</td><td>${c.latencyMs ?? '-'}ms</td><td>$${(c.usage?.cost ?? 0).toFixed(5)}</td></tr>`
    )
    .join('\n');

  const chairmanFailed = run.chairmanResult?.status !== 'ok';

  const html = `${htmlHead('LLM Council — Multi-Provider Report')}
<div class="app">
<nav class="sidebar">
  <h1>LLM Council</h1>
  <div class="run-meta">
    Panel: ${escapeHtml(run.panelName)}${run.neutral ? ' (neutral)' : ' (persona)'}<br>
    Chairman: ${escapeHtml(run.chairman.slug)}<br>
    Generated ${escapeHtml(new Date().toISOString())}
  </div>
  ${navItems}
  <div class="cost-pill">Total run cost: $${(run.totalCostUsd ?? 0).toFixed(5)}</div>
</nav>
<main class="main">
<div class="main-inner">

<div class="message user" id="question">
  <div class="message-role">You</div>
  <div class="message-bubble">${escapeHtml(run.framedQuestion)}</div>
</div>

<div class="message assistant">
  <div class="message-role">LLM Council</div>

  <h2 class="section-title" id="stage1">Stage 1 · Independent Opinions</h2>
  ${renderTabGroup('op', opinionTabs)}

  <h2 class="section-title" id="stage2">Stage 2 · Peer Review</h2>
  <table><tr><th>Letter</th><th>Model</th></tr>${letterMapRows}</table>
  ${renderTabGroup('rv', reviewTabs)}
  ${aggregateRankings.length ? `<div class="aggregate-rankings"><h4>Aggregate rankings (lower avg rank = more convincing)</h4>${aggregateRows}</div>` : ''}

  <h2 class="section-title" id="stage3">Stage 3 · Chairman Verdict</h2>
  ${run.chairmanResult?.actingChairman ? '<p class="caveat">Acting chairman substitution — see Cost &amp; Metadata below.</p>' : ''}
  <div class="final-response${chairmanFailed ? ' failed' : ''}">
    <div class="chairman-label">CHAIRMAN — ${escapeHtml(run.chairman.slug)}</div>
    <div class="final-text">${chairmanFailed ? `Chairman synthesis unavailable: ${escapeHtml(run.chairmanResult?.error ?? 'unknown error')}` : escapeHtml(run.chairmanResult.text)}</div>
  </div>
</div>

<h2 class="section-title" id="alignment">Alignment / Divergence</h2>
<div class="grid">${gridCells}</div>

${failureRows ? `<h2 class="section-title">Failures</h2><table><tr><th>Model</th><th>Stage</th><th>Message</th></tr>${failureRows}</table>` : ''}

<h2 class="section-title" id="metadata">Cost &amp; Metadata</h2>
<table><tr><th>Model</th><th>Status</th><th>Latency</th><th>Cost</th></tr>${costRows}</table>
<p>Total run cost: $${(run.totalCostUsd ?? 0).toFixed(5)}</p>

<footer class="run-footer">
<p>Models used: ${run.models.map(m => escapeHtml(m.slug)).join(', ')} — chairman: ${escapeHtml(run.chairman.slug)}</p>
<p>Self-preference tally: ${selfPref.k}/${selfPref.n} reviewers ranked their own (anonymized) response first.</p>
<p class="caveat">Anonymization caveat: letter assignment is nominal. Writing style is a signature across genuinely different models — anonymity is not guaranteed, only explicit self-identification is stripped.</p>
${collisionNote ? `<p class="caveat">${escapeHtml(collisionNote)}</p>` : ''}
</footer>

</div>
</main>
</div>
${htmlFoot()}`;

  writeFileSync(filepath, html, 'utf8');
  return filepath;
}

/** Writes council-transcript-<timestamp>.md into outDir. */
export function writeTranscript(run, outDir, timestamp = ts()) {
  ensureOutDir(outDir);
  const filename = `council-transcript-${timestamp}.md`;
  const filepath = join(outDir, filename);

  const lines = [];
  lines.push('# LLM Council — Multi-Provider Transcript');
  lines.push('');
  lines.push('## Original Question');
  lines.push('');
  lines.push(run.question.scrubbedText);
  lines.push('');
  lines.push('## Framed Question');
  lines.push('');
  lines.push(run.framedQuestion);
  lines.push('');
  lines.push('## Independent Opinions');
  lines.push('');
  for (const o of run.opinions) {
    const personaLabel = o.persona ? ` (${o.persona})` : '';
    lines.push(`### ${o.model}${personaLabel}`);
    lines.push('');
    lines.push(o.status === 'ok' ? o.text : `*Failed: ${o.error ?? 'unknown error'}*`);
    lines.push('');
  }
  lines.push('## Letter Mapping (revealed)');
  lines.push('');
  for (const a of run.anonymization ?? []) {
    lines.push(`- Response ${a.letter} = ${a.model}`);
  }
  lines.push('');
  lines.push('## Peer Reviews');
  lines.push('');
  for (const r of run.reviews) {
    lines.push(`### Reviewer: ${r.model} (was Response ${r.letter ?? '?'})`);
    lines.push('');
    lines.push(r.status === 'ok' ? r.text : `*Failed: ${r.error ?? 'unknown error'}*`);
    lines.push('');
  }
  lines.push('## Chairman Synthesis');
  lines.push('');
  if (run.chairmanResult?.actingChairman) {
    lines.push(`*Acting chairman substitution: ${run.chairmanResult.model} (highest-ranked surviving panelist) — the designated chairman failed twice.*`);
    lines.push('');
  }
  lines.push(
    run.chairmanResult?.status === 'ok'
      ? run.chairmanResult.text
      : `*Chairman synthesis unavailable: ${run.chairmanResult?.error ?? 'unknown error'}*`
  );
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- Panel: ${run.panelName}${run.neutral ? ' (neutral prompts)' : ' (persona prompts)'}`);
  lines.push(`- Models: ${run.models.map(m => m.slug).join(', ')}`);
  lines.push(`- Chairman: ${run.chairman.slug}`);
  lines.push(`- Total cost: $${(run.totalCostUsd ?? 0).toFixed(5)}`);
  lines.push(`- Failures: ${(run.failures ?? []).length ? run.failures.map(f => `${f.model}/${f.stage}`).join(', ') : 'none'}`);
  const scrubHitsTotal =
    (run.question.hits ?? []).reduce((s, h) => s + h.count, 0) +
    (run.contextFiles ?? []).reduce((s, f) => s + (f.hits ?? []).reduce((s2, h) => s2 + h.count, 0), 0);
  lines.push(`- Scrub hit count: ${scrubHitsTotal}`);
  lines.push('');

  writeFileSync(filepath, lines.join('\n'), 'utf8');
  return filepath;
}

/** Writes council-run-<timestamp>.json into outDir — the audit trail of what was actually sent. */
export function writeRunJson(run, outDir, timestamp = ts()) {
  ensureOutDir(outDir);
  const filename = `council-run-${timestamp}.json`;
  const filepath = join(outDir, filename);

  const selfPref = computeSelfPreference(run);
  const topPickTally = Object.fromEntries(computeTopPickTally(run));

  const payload = {
    question: run.question,
    contextFiles: run.contextFiles,
    framedQuestion: run.framedQuestion,
    panelName: run.panelName,
    neutral: run.neutral,
    policy: run.policy,
    models: run.models,
    chairman: run.chairman,
    opinions: run.opinions,
    anonymization: run.anonymization,
    reviews: run.reviews,
    chairmanResult: run.chairmanResult,
    rankingTallies: { topPickTally, selfPreference: selfPref },
    totalCostUsd: run.totalCostUsd,
    failures: run.failures,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    exitCode: run.exitCode,
  };

  writeFileSync(filepath, JSON.stringify(payload, null, 2), 'utf8');
  return filepath;
}

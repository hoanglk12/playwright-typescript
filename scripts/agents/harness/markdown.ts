const LINE_BREAKS = /\s*[\r\n]\s*/g;
const MARKDOWN_ACTIVE = /[\\`*_[\]()<>!#|~]/g;

const HEADING_LINE = /^(#{1,6})\s/;
const FENCE_LINE = /^\s*```/;
const HEADING_TERMINATOR = /^[\s.:]/;

function headingLevel(line: string): number | undefined {
  const match = HEADING_LINE.exec(line);
  return match === null ? undefined : match[1].length;
}

export function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split(/\r?\n/);
  const level = headingLevel(`${heading} `);
  if (level === undefined) throw new Error(`invalid heading: ${heading}`);

  let inFence = false;
  let start = -1;
  let end = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE_LINE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (start === -1) {
      const rest = line.slice(heading.length);
      if (line.startsWith(heading) && (rest === '' || HEADING_TERMINATOR.test(rest))) start = index;
    } else {
      const current = headingLevel(line);
      if (current !== undefined && current <= level) {
        end = index;
        break;
      }
    }
  }

  if (start === -1) throw new Error(`rule heading not found: "${heading}"`);
  const section = lines.slice(start, end).join('\n').trim();
  if (section.split('\n').length < 2) throw new Error(`rule section is empty: "${heading}"`);
  return section;
}

export function codeSpan(text: string): string {
  // Block structure is parsed before code spans, so a line break inside the span could start a heading or list.
  const collapsed = text.replace(LINE_BREAKS, ' ');
  const longestRun = Math.max(0, ...(collapsed.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  const needsPadding = collapsed.startsWith('`') || collapsed.endsWith('`');
  const content = needsPadding ? ` ${collapsed} ` : collapsed;
  return `${fence}${content}${fence}`;
}

export function flatten(text: string): string {
  return text.replace(/\s+/g, ' ');
}

export function inert(text: string): string {
  return flatten(text).replace(MARKDOWN_ACTIVE, '\\$&');
}

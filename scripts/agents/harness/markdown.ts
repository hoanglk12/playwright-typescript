const LINE_BREAKS = /\s*[\r\n]\s*/g;

export function codeSpan(text: string): string {
  // Block structure is parsed before code spans, so a line break inside the span could start a heading or list.
  const collapsed = text.replace(LINE_BREAKS, ' ');
  const longestRun = Math.max(0, ...(collapsed.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longestRun + 1);
  const needsPadding = collapsed.startsWith('`') || collapsed.endsWith('`');
  const content = needsPadding ? ` ${collapsed} ` : collapsed;
  return `${fence}${content}${fence}`;
}

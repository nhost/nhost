import type { Report } from '../contracts/report.mts';

export function formatText(report: Report): string {
  const lines = [
    `Design doctor: ${report.score === null ? 'not scored' : `${report.score}/100`} (${report.status})`,
    ...report.rules.map(({ id, count }) => `  ${id}: ${count}`),
    `Coverage: ${report.coverage.processed.length}/${report.coverage.expected} expected files processed; ${report.coverage.skipped.length} skipped`,
    ...report.coverage.skipped.map(
      ({ path, reason }) => `  ${path}: ${reason}`,
    ),
    `Findings: ${report.baseline.new} new, ${report.baseline.baselined} baselined; suppressions: ${report.suppressions.length}`,
    ...report.suppressions.map(
      ({ path, start, ruleId, state, count, addedInPr }) =>
        `  ${path}:${start.line}:${start.column} ${ruleId}: ${state} (${count} findings)${addedInPr ? ' [added in this PR]' : ''}`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

export function formatMarkdown(report: Report, maxBytes = 65536): string {
  const heading = `# Dashboard design doctor\n\nScore: **${report.score === null ? 'not scored' : `${report.score}/100`}** (${report.status}). Coverage: ${report.coverage.processed.length}/${report.coverage.expected} expected files; ${report.coverage.skipped.length} skipped.\n\n`;
  const table = `| Rule | Findings |\n| --- | ---: |\n${report.rules.map(({ id, count }) => `| ${id} | ${count} |`).join('\n')}\n\n`;
  const entries = report.files.flatMap((file) =>
    file.findings.map(
      (finding) =>
        `- \`${file.path}:${finding.start.line}:${finding.start.column}\` **${finding.ruleId}** \`${finding.subject.replaceAll('`', '\\`')}\` (${finding.status}): ${finding.guidance.replaceAll('\n', ' ')}\n`,
    ),
  );
  entries.push(
    ...report.suppressions.map(
      ({ path, start, ruleId, state, count, addedInPr }) =>
        `- \`${path}:${start.line}:${start.column}\` suppression **${ruleId}**: ${state} (${count} findings)${addedInPr ? ' [added in this PR]' : ''}\n`,
    ),
  );
  const suffix =
    '\n_Truncated; use `pnpm design-doctor --json` for all findings._\n';
  let output = heading + table;
  for (const entry of entries) {
    if (Buffer.byteLength(output + entry + suffix, 'utf8') > maxBytes) {
      return output + suffix;
    }
    output += entry;
  }
  return output;
}

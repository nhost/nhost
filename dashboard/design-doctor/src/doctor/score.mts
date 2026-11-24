import type { Finding, Report } from '../contracts/report.mts';
import type { Manifest } from '../grit/manifest.mts';

export function score(
  expected: readonly string[],
  processed: readonly string[],
  findings: readonly Finding[],
  rules: Manifest['rules'],
): Pick<Report, 'score' | 'files' | 'rules'> {
  const analyzed = new Set(processed);
  const weights = new Map(rules.map((rule) => [rule.id, rule.weight]));
  const counts = new Map(rules.map((rule) => [rule.id, 0]));
  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
    byFile.set(finding.path, [...(byFile.get(finding.path) ?? []), finding]);
  }
  const files = expected.map((path) => {
    const entries = byFile.get(path) ?? [];
    const penalty = entries
      .filter((finding) => finding.status !== 'suppressed')
      .reduce(
        (total, finding) => total + (weights.get(finding.ruleId) ?? 0),
        0,
      );
    return {
      path,
      findings: entries,
      health: analyzed.has(path) ? Math.max(0, 1 - penalty / 10) : 0,
    };
  });
  return {
    score: files.length
      ? Math.round(
          (100 * files.reduce((total, file) => total + file.health, 0)) /
            files.length,
        )
      : null,
    files,
    rules: rules.map(({ id, weight }) => ({
      id,
      weight,
      count: counts.get(id) ?? 0,
    })),
  };
}

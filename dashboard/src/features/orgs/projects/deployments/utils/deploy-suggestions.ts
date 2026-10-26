import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';
import type { GitHubCommit } from '@/lib/github';

export function rankBySha<T>(
  items: T[],
  query: string,
  getSha: (item: T) => string | null | undefined,
): T[] {
  const normalized = query.toLowerCase();
  function rank(item: T): number {
    const sha = getSha(item)?.toLowerCase();
    if (!normalized || !sha || !/^[a-f\d]{40}$/.test(sha)) {
      return 2;
    }
    if (sha === normalized) {
      return 0;
    }
    return sha.startsWith(normalized) ? 1 : 2;
  }
  return [...items].sort((left, right) => rank(left) - rank(right));
}

export function filterCommits(
  commits: GitHubCommit[],
  query: string,
): GitHubCommit[] {
  if (!query) {
    return [];
  }
  const normalized = query.toLowerCase();
  const matches = commits.filter(
    (commit) =>
      commit.message.toLowerCase().includes(normalized) ||
      commit.sha.toLowerCase().startsWith(normalized),
  );
  return rankBySha(matches, query, (commit) => commit.sha).slice(0, 5);
}

export interface HighlightPart {
  text: string;
  highlighted: boolean;
  start: number;
}

export function splitHighlight(text: string, query: string): HighlightPart[] {
  if (!query) {
    return [{ text, highlighted: false, start: 0 }];
  }
  const normalized = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: HighlightPart[] = [];
  let start = 0;
  let match = normalized.indexOf(needle);
  while (match !== -1) {
    if (match > start) {
      parts.push({ text: text.slice(start, match), highlighted: false, start });
    }
    start = match + query.length;
    parts.push({
      text: text.slice(match, start),
      highlighted: true,
      start: match,
    });
    match = normalized.indexOf(needle, start);
  }
  if (start < text.length || parts.length === 0) {
    parts.push({ text: text.slice(start), highlighted: false, start });
  }
  return parts;
}

export function escapeILike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function dedupeDeploymentsByCommit(
  deployments: UnifiedDeploymentRowFragment[],
): UnifiedDeploymentRowFragment[] {
  const seen = new Set<string>();
  return deployments.filter((deployment) => {
    if (!deployment.commitSHA || seen.has(deployment.commitSHA)) {
      return false;
    }
    seen.add(deployment.commitSHA);
    return true;
  });
}

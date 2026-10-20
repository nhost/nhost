import { escapeRegExp } from '@/utils/escapeRegExp';

export interface TextMatch {
  from: number;
  to: number;
}

/**
 * Finds every occurrence of `term` in `text`, case-insensitively. Matches do
 * not overlap: the search continues after the end of the previous match.
 *
 * Uses a case-insensitive regex instead of searching a lowercased copy:
 * lowercasing can change the length of the text (`İ` becomes two characters),
 * which would shift the positions.
 */
export default function findTextMatches(
  text: string,
  term: string,
): TextMatch[] {
  if (!term) {
    return [];
  }

  return Array.from(
    text.matchAll(new RegExp(escapeRegExp(term), 'gi')),
    (match) => ({ from: match.index, to: match.index + match[0].length }),
  );
}

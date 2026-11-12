import { useState } from 'react';
import type { SchemaSearchResult } from './types';

/**
 * Holds a list of search matches and the one being shown, and steps through
 * them in a loop.
 *
 * @param show - Called with all matches and the index of the one to show,
 * also when there are no matches.
 */
export default function useSearchMatches<T>(
  show: (matches: T[], index: number) => void,
) {
  const [matches, setMatches] = useState<T[]>([]);
  const [index, setIndex] = useState(0);

  const goTo = (nextMatches: T[], nextIndex: number): SchemaSearchResult => {
    setMatches(nextMatches);
    setIndex(nextIndex);
    show(nextMatches, nextIndex);

    return { count: nextMatches.length, index: nextIndex };
  };

  const step = (offset: number) => {
    if (matches.length === 0) {
      return null;
    }

    return goTo(matches, (index + offset + matches.length) % matches.length);
  };

  return {
    start: (nextMatches: T[]) => goTo(nextMatches, 0),
    next: () => step(1),
    previous: () => step(-1),
  };
}

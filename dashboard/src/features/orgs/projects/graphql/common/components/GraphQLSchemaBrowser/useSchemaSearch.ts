import { useRef, useState } from 'react';
import type { SchemaSearchHandle, SchemaSearchResult } from './types';

/**
 * Connects a `SchemaSearchBar` to a schema view that exposes a
 * `SchemaSearchHandle`: pass `searchRef` to the view and the rest to the bar.
 */
export default function useSchemaSearch() {
  const searchRef = useRef<SchemaSearchHandle>(null);
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<SchemaSearchResult | null>(null);

  const step = (direction: 'next' | 'previous') => {
    const nextResult = searchRef.current?.[direction]();

    if (nextResult) {
      setResult(nextResult);
    }
  };

  return {
    searchRef,
    term,
    result,
    /**
     * Forgets the last result, e.g. when the view shows a different schema.
     */
    resetResult: () => setResult(null),
    changeTerm: (nextTerm: string) => {
      setTerm(nextTerm);
      setResult(null);

      if (!nextTerm.trim()) {
        searchRef.current?.clear();
      }
    },
    find: () => {
      if (!term.trim() || !searchRef.current) {
        return;
      }

      setResult(searchRef.current.find(term));
    },
    next: () => step('next'),
    previous: () => step('previous'),
  };
}

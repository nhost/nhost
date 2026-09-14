import { useEffect, useState } from 'react';
import screens from '@/constants/screens';

export interface UseMediaQueryOptions {
  /**
   * The value before the query is read on the client, including during server
   * rendering. Pick the layout most users get, so they do not see the other
   * one flash on load.
   */
  initialValue?: boolean;
}

const useMediaQuery = (
  query: keyof typeof screens,
  { initialValue = false }: UseMediaQueryOptions = {},
): boolean => {
  const [isMatch, setMatch] = useState<boolean>(initialValue);

  useEffect(() => {
    // Ensure this runs only on the client side
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = `(min-width: ${screens[query]})`;
    const matchQueryList = window.matchMedia(mediaQuery);

    const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);

    setMatch(matchQueryList.matches);

    matchQueryList.addEventListener('change', onChange);

    return () => matchQueryList.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
};

export default useMediaQuery;

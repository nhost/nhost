import { useEffect, useState } from 'react';
import screens from '@/constants/screens';

const useMediaQuery = (query: keyof typeof screens): boolean => {
  const [isMatch, setMatch] = useState<boolean>(false);

  useEffect(() => {
    // Ensure this runs only on the client side
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = `(min-width: ${screens[query]})`;
    const matchQueryList = window.matchMedia(mediaQuery);

    const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);

    // Set initial value
    setMatch(matchQueryList.matches);

    // Listen for changes
    matchQueryList.addEventListener('change', onChange);

    return () => matchQueryList.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
};

export default useMediaQuery;

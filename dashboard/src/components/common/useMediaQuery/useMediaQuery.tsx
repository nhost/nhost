import { useEffect, useState } from 'react';
import resolveConfig from 'tailwindcss/resolveConfig';
// eslint-disable-next-line no-restricted-imports
import tailwindConfig from '../../../../tailwind.config';

const fullConfig = resolveConfig(tailwindConfig);

const {
  theme: { screens },
} = fullConfig;

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

    // Clean up the listener on unmount
    // eslint-disable-next-line consistent-return
    return () => matchQueryList.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
};

export default useMediaQuery;

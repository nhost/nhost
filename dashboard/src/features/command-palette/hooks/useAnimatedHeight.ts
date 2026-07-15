import { useMeasure } from '@uidotdev/usehooks';
import { useEffect, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface UseAnimatedHeightResult<T extends HTMLElement> {
  contentRef: (node: T | null) => void;
  height: number | undefined;
  animate: boolean;
}

export const useAnimatedHeight = <
  T extends HTMLElement = HTMLDivElement,
>(): UseAnimatedHeightResult<T> => {
  const [contentRef, { height: measuredHeight }] = useMeasure<T>();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  const height =
    measuredHeight !== null && measuredHeight > 0 ? measuredHeight : undefined;

  return {
    contentRef,
    height,
    animate: !reducedMotion && height !== undefined,
  };
};

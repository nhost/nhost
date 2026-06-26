import { useCallback, useEffect, useRef, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface UseAnimatedHeightResult<T extends HTMLElement> {
  contentRef: (node: T | null) => void;
  height: number | undefined;
  animate: boolean;
}

export const useAnimatedHeight = <
  T extends HTMLElement = HTMLDivElement,
>(): UseAnimatedHeightResult<T> => {
  const observerRef = useRef<ResizeObserver | undefined>(undefined);
  const [height, setHeight] = useState<number>();
  const [hasMeasured, setHasMeasured] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const contentRef = useCallback((node: T | null) => {
    observerRef.current?.disconnect();

    if (!node) {
      return;
    }

    const measure = () => {
      const next = node.offsetHeight;
      setHeight(next > 0 ? next : undefined);
      setHasMeasured(true);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useEffect(
    () => () => {
      observerRef.current?.disconnect();
    },
    [],
  );

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

  return {
    contentRef,
    height,
    animate: hasMeasured && !reducedMotion && height !== undefined,
  };
};

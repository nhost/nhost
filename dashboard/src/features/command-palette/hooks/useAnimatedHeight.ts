import { useMeasure } from '@uidotdev/usehooks';
import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeToReducedMotion = (onStoreChange: VoidFunction) => {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener('change', onStoreChange);

  return () => mediaQuery.removeEventListener('change', onStoreChange);
};

const getReducedMotionSnapshot = () =>
  window.matchMedia(REDUCED_MOTION_QUERY).matches;

const getReducedMotionServerSnapshot = () => false;

interface UseAnimatedHeightResult<T extends HTMLElement> {
  contentRef: (node: T | null) => void;
  height: number | undefined;
  animate: boolean;
}

export const useAnimatedHeight = <
  T extends HTMLElement = HTMLDivElement,
>(): UseAnimatedHeightResult<T> => {
  const [contentRef, { height: measuredHeight }] = useMeasure<T>();
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const height =
    measuredHeight !== null && measuredHeight > 0 ? measuredHeight : undefined;

  return {
    contentRef,
    height,
    animate: !reducedMotion && height !== undefined,
  };
};

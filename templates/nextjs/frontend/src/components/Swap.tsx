import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const FADE =
  'transition-opacity duration-300 ease-in-out motion-reduce:transition-none';

/**
 * Two things in one place, cross-fading from the first to the second.
 *
 * Both are always laid out, in the same grid cell, so the place is the size
 * of the larger of them whichever is showing, and nothing around it moves
 * when they change over. The hidden one is `inert`, so it can be neither
 * clicked nor reached by keyboard or screen reader. Spans, so it can sit
 * inside a button.
 */
export default function Swap({
  showSecond,
  first,
  second,
  className,
}: {
  showSecond: boolean;
  first: ReactNode;
  second: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('grid', className)}>
      <span
        inert={showSecond}
        className={cn(
          'col-start-1 row-start-1',
          FADE,
          showSecond ? 'opacity-0' : 'opacity-100',
        )}
      >
        {first}
      </span>
      <span
        inert={!showSecond}
        className={cn(
          'col-start-1 row-start-1',
          FADE,
          showSecond ? 'opacity-100' : 'opacity-0',
        )}
      >
        {second}
      </span>
    </span>
  );
}

/** One thing fading in and out, its space kept either way. */
export function Fade({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <span
      inert={!show}
      className={cn(FADE, show ? 'opacity-100' : 'opacity-0')}
    >
      {children}
    </span>
  );
}

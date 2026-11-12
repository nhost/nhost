import * as React from 'react';
import { cn } from '@/lib/utils';

const StickyHeaderCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = React.useState(false);

  React.useImperativeHandle(ref, () => headerRef.current!);

  // Publishes the header's height on the card, so other sticky elements in
  // the card can sit right below it.
  React.useEffect(() => {
    const header = headerRef.current;
    const card = header?.parentElement;

    if (!header || !card) {
      return undefined;
    }

    const observer = new ResizeObserver(() =>
      card.style.setProperty(
        '--sticky-header-height',
        `${header.offsetHeight}px`,
      ),
    );
    observer.observe(header);

    return () => {
      observer.disconnect();
      card.style.removeProperty('--sticky-header-height');
    };
  }, []);

  // CSS cannot tell whether a sticky element is stuck, so a sentinel right
  // above the header reports it: once it scrolls out of view, the header is
  // stuck and gets its shadow.
  React.useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) =>
      setIsStuck(!entry.isIntersecting),
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden />
      <div
        ref={headerRef}
        data-stuck={isStuck ? 'true' : undefined}
        className={cn(
          'sticky top-0 z-10 flex flex-col gap-3 rounded-t-lg border-b bg-background/60 px-6 py-6 backdrop-blur-md backdrop-saturate-150 transition-shadow duration-200 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-1 before:h-2 before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:opacity-0 before:blur-sm before:transition-opacity before:duration-200 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-foreground/30 after:to-transparent after:opacity-0 after:transition-opacity after:duration-200 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between',
          isStuck && 'shadow-sticky before:opacity-100 after:opacity-100',
          className,
        )}
        {...props}
      />
    </>
  );
});
StickyHeaderCardHeader.displayName = 'StickyHeaderCardHeader';

export { StickyHeaderCardHeader };

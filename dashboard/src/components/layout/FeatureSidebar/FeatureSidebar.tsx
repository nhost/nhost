import Image from 'next/image';
import { type ReactNode, useEffect, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';

interface FeatureSidebarProps {
  children: ReactNode | ((collapse: VoidFunction) => ReactNode);
  className?: string;
  toggleIcon?: ReactNode;
  mobileBreakpoint?: 'sm' | 'md';
  toggleOffset?: 'left-4' | 'left-8';
  withErrorBoundary?: boolean;
}

export default function FeatureSidebar({
  children,
  className,
  toggleIcon,
  mobileBreakpoint = 'sm',
  toggleOffset = 'left-4',
  withErrorBoundary = true,
}: FeatureSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  function toggleExpanded() {
    setExpanded((prev) => !prev);
  }

  useEffect(() => {
    function closeSidebarWhenEscapeIsPressed(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', closeSidebarWhenEscapeIsPressed);
    }

    return () =>
      document.removeEventListener('keydown', closeSidebarWhenEscapeIsPressed);
  }, []);

  const collapse = () => setExpanded(false);

  const renderedChildren =
    typeof children === 'function' ? children(collapse) : children;

  const defaultToggleIcon = (
    <Image
      width={16}
      height={16}
      src="/assets/table.svg"
      alt="A monochrome table"
    />
  );

  return (
    <>
      <button
        type="button"
        className={cn(
          'absolute inset-0 z-[34] bg-black/50',
          expanded ? 'block' : 'hidden',
          mobileBreakpoint === 'sm' && 'sm:hidden',
          mobileBreakpoint === 'md' && 'md:hidden',
        )}
        tabIndex={-1}
        onClick={collapse}
        aria-label="Close sidebar overlay"
      />

      <aside
        className={cn(
          'absolute top-0 z-[35] h-full w-full max-w-sidebar overflow-auto border-r-1 pt-2 pb-17 motion-safe:transition-transform',
          mobileBreakpoint === 'sm' &&
            'sm:relative sm:z-0 sm:h-full sm:pt-2.5 sm:pb-0 sm:transition-none',
          mobileBreakpoint === 'md' &&
            'md:relative md:z-0 md:h-full md:py-2.5 md:transition-none',
          expanded && 'translate-x-0',
          !expanded &&
            mobileBreakpoint === 'sm' &&
            '-translate-x-full sm:translate-x-0',
          !expanded &&
            mobileBreakpoint === 'md' &&
            '-translate-x-full md:translate-x-0',
          className,
        )}
      >
        {withErrorBoundary ? (
          <RetryableErrorBoundary>{renderedChildren}</RetryableErrorBoundary>
        ) : (
          renderedChildren
        )}
      </aside>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'absolute bottom-4 z-[38] h-11 w-11 rounded-full border bg-primary',
          toggleOffset === 'left-4' && 'left-4',
          toggleOffset === 'left-8' && 'left-8',
          mobileBreakpoint === 'sm' && 'sm:hidden',
          mobileBreakpoint === 'md' && 'md:hidden',
        )}
        onClick={toggleExpanded}
        aria-label="Toggle sidebar"
      >
        {toggleIcon ?? defaultToggleIcon}
      </Button>
    </>
  );
}

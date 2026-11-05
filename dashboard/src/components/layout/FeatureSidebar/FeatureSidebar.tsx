import Image from 'next/image';
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
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
  /**
   * Lets people drag the right edge to change the sidebar width on larger
   * screens. The width is saved in local storage under this key.
   */
  resizeStorageKey?: string;
}

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const KEYBOARD_STEP = 16;

function clampWidth(width: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));
}

function readStoredWidth(storageKey: string) {
  try {
    const storedWidth = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(storedWidth) && storedWidth > 0
      ? clampWidth(storedWidth)
      : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function storeWidth(storageKey: string, width: number) {
  try {
    window.localStorage.setItem(storageKey, String(width));
  } catch {
    // Width just won't be remembered when storage is unavailable.
  }
}

export default function FeatureSidebar({
  children,
  className,
  toggleIcon,
  mobileBreakpoint = 'sm',
  toggleOffset = 'left-4',
  withErrorBoundary = true,
  resizeStorageKey,
}: FeatureSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef<{ pointerX: number; width: number } | null>(null);
  const isResizable = Boolean(resizeStorageKey);

  useEffect(() => {
    if (resizeStorageKey) {
      setWidth(readStoredWidth(resizeStorageKey));
    }
  }, [resizeStorageKey]);

  function commitWidth(nextWidth: number) {
    const clampedWidth = clampWidth(nextWidth);
    setWidth(clampedWidth);
    if (resizeStorageKey) {
      storeWidth(resizeStorageKey, clampedWidth);
    }
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerX: event.clientX, width };
    setIsResizing(true);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) {
      return;
    }
    setWidth(
      clampWidth(
        dragStart.current.width + event.clientX - dragStart.current.pointerX,
      ),
    );
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStart.current) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStart.current = null;
    setIsResizing(false);
    commitWidth(width);
  }

  function handleResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitWidth(width - KEYBOARD_STEP);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitWidth(width + KEYBOARD_STEP);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commitWidth(MIN_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      commitWidth(MAX_WIDTH);
    }
  }

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
          'absolute top-0 left-0 z-[35] h-full w-full max-w-sidebar overflow-auto border-r-1 bg-background pt-2 pb-17 motion-safe:transition-transform',
          mobileBreakpoint === 'sm' &&
            'sm:relative sm:z-0 sm:h-full sm:pt-2.5 sm:pb-0 sm:transition-none',
          mobileBreakpoint === 'md' &&
            'md:relative md:z-0 md:h-full md:py-2.5 md:transition-none',
          isResizable &&
            mobileBreakpoint === 'sm' &&
            'sm:w-[var(--feature-sidebar-width)] sm:max-w-none',
          isResizable &&
            mobileBreakpoint === 'md' &&
            'md:w-[var(--feature-sidebar-width)] md:max-w-none',
          isResizing && 'select-none',
          expanded && 'translate-x-0',
          !expanded &&
            mobileBreakpoint === 'sm' &&
            '-translate-x-full sm:translate-x-0',
          !expanded &&
            mobileBreakpoint === 'md' &&
            '-translate-x-full md:translate-x-0',
          className,
        )}
        style={
          isResizable
            ? ({ '--feature-sidebar-width': `${width}px` } as CSSProperties)
            : undefined
        }
      >
        {withErrorBoundary ? (
          <RetryableErrorBoundary>{renderedChildren}</RetryableErrorBoundary>
        ) : (
          renderedChildren
        )}

        {isResizable && (
          // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resize handle, an hr cannot take focus or pointer events.
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            tabIndex={0}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            onKeyDown={handleResizeKeyDown}
            onDoubleClick={() => commitWidth(DEFAULT_WIDTH)}
            className={cn(
              'absolute top-0 right-0 z-10 hidden h-full w-1.5 cursor-col-resize touch-none after:absolute after:inset-y-0 after:right-0 after:w-px after:transition-colors hover:after:bg-primary focus-visible:outline-none focus-visible:after:bg-primary',
              mobileBreakpoint === 'sm' && 'sm:block',
              mobileBreakpoint === 'md' && 'md:block',
              isResizing && 'after:bg-primary',
            )}
          />
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

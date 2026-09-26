import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The body every route-segment `error.tsx` renders. Next.js requires the
 * boundary file itself to live at each segment, but the markup inside it
 * does not have to be copied at every one of them.
 *
 * `headingLevel` defaults to `h1` for the page-level boundaries. The modal
 * boundary passes `h3`, because `DialogTitle` above it already renders an
 * `h2` and a heading can't skip backwards under its own dialog's title.
 */
export function ErrorFallback({
  reset,
  className,
  headingLevel: Heading = 'h1',
}: {
  reset: () => void;
  className?: string;
  headingLevel?: 'h1' | 'h3';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 pt-24 text-center',
        className,
      )}
    >
      <Heading className="font-bold text-2xl tracking-tight">
        Something went wrong
      </Heading>
      <p className="text-muted-foreground text-sm">
        This couldn&apos;t load. It may be a temporary issue with the server.
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

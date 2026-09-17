import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StepState = 'ok' | 'pending' | 'error';

const dot: Record<StepState, string> = {
  ok: 'bg-emerald-500',
  pending: 'bg-muted-foreground/40',
  error: 'bg-destructive',
};

// Only the live states pulse. A halo on every tile would be noise, and the
// point of the pulse is that something is currently true, not merely filled in.
const halo: Record<StepState, string> = {
  ok: 'bg-emerald-500/70',
  pending: '',
  error: 'bg-destructive/70',
};

const label: Record<StepState, string> = {
  ok: 'Working',
  pending: 'Not done yet',
  error: 'Failing',
};

export function StatusDot({ state }: { state: StepState }) {
  return (
    <span
      role="img"
      aria-label={label[state]}
      className="relative flex size-2.5 shrink-0"
    >
      {halo[state] ? (
        <span
          className={cn(
            'absolute inline-flex size-full animate-ping rounded-full opacity-75',
            halo[state],
          )}
        />
      ) : null}
      <span
        className={cn(
          'relative inline-flex size-2.5 rounded-full ring-2 ring-background',
          dot[state],
        )}
      />
    </span>
  );
}

/**
 * One tile in the home page grid.
 *
 * Deliberately not numbered: these are three things that are either true or
 * not, checked live on every render, rather than an ordered tutorial. The
 * action sits at the bottom so tiles line up next to each other.
 */
export function StatusTile({
  state,
  title,
  action,
  children,
}: {
  state: StepState;
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="gap-4 transition-shadow hover:shadow-md">
      <CardHeader className="gap-1.5">
        <CardTitle className="flex items-center gap-2 text-base">
          <StatusDot state={state} />
          {title}
        </CardTitle>
        {children ? <CardDescription>{children}</CardDescription> : null}
      </CardHeader>

      {action ? <CardContent className="mt-auto">{action}</CardContent> : null}
    </Card>
  );
}

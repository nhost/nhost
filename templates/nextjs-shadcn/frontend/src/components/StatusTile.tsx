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

// Flat colour, with light coming off the live ones rather than modelled on
// them. The unlit state gets no glow, which is the whole difference.
const fill: Record<StepState, string> = {
  ok: 'bg-emerald-500',
  pending: 'bg-muted-foreground/40',
  error: 'bg-destructive',
};

const glow: Record<StepState, string | null> = {
  ok: '16 185 129',
  pending: null,
  error: '239 68 68',
};

const label: Record<StepState, string> = {
  ok: 'Working',
  pending: 'Not done yet',
  error: 'Failing',
};

export function StatusDot({ state }: { state: StepState }) {
  const halo = glow[state];

  return (
    <span
      role="img"
      aria-label={label[state]}
      className="relative flex size-2.5 shrink-0 items-center justify-center"
    >
      {halo ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 4px 1px rgb(${halo} / 0.45)` }}
        />
      ) : null}

      <span
        aria-hidden
        className={cn('relative size-2.5 rounded-full', fill[state])}
      />
    </span>
  );
}

/**
 * One tile in the home page grid.
 *
 * Deliberately not numbered: these are things that are either true or not,
 * checked live on every render, rather than an ordered tutorial. The action
 * sits at the bottom so tiles line up next to each other whatever length their
 * text runs to.
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
    <Card className="gap-3 py-4 transition-shadow hover:shadow-md">
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

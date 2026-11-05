import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type InstallStepState = 'complete' | 'current' | 'upcoming';

export interface InstallStepProps {
  number: number;
  title: string;
  state: InstallStepState;
  isLast?: boolean;
  children: ReactNode;
}

export default function InstallStep({
  number,
  title,
  state,
  isLast = false,
  children,
}: InstallStepProps) {
  return (
    <li
      className="relative flex gap-3"
      aria-current={state === 'current' ? 'step' : undefined}
      data-state={state}
    >
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-8 bottom-1 left-[13px] w-px bg-border"
        />
      )}
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border font-medium text-sm',
          state === 'complete' &&
            'border-emerald-600 bg-emerald-600 text-white',
          state === 'current' && 'border-primary text-primary',
          state === 'upcoming' && 'text-muted-foreground',
        )}
      >
        {state === 'complete' ? <Check className="size-4" /> : number}
      </span>
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-3',
          !isLast && 'pb-6',
          state === 'upcoming' && 'opacity-60',
        )}
      >
        <h3 className="pt-1 font-medium leading-5">
          <span className="sr-only">
            Step {number}
            {state === 'complete' ? ' (completed)' : ''}:{' '}
          </span>
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

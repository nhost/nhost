import { createContext, useContext, useSyncExternalStore } from 'react';
import {
  formatDuration,
  formatSize,
  IDLE_RESPONSE_STATUS,
  type ResponseStatusStore,
  type ResponseStatus as ResponseStatusValue,
} from '@/features/orgs/projects/graphql/common/utils/measureResponse';
import { cn } from '@/lib/utils';

export const ResponseStatusContext = createContext<ResponseStatusStore | null>(
  null,
);

const noopSubscribe = () => () => {};
const getIdleStatus = () => IDLE_RESPONSE_STATUS;

export function useResponseStatus(): ResponseStatusValue {
  const store = useContext(ResponseStatusContext);

  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? getIdleStatus,
    getIdleStatus,
  );
}

type PillTone = 'idle' | 'busy' | 'success' | 'error';

const PILL_TONE_CLASSES: Record<PillTone, string> = {
  idle: 'bg-muted text-muted-foreground',
  busy: 'bg-primary/10 text-primary',
  // No success token yet; same emerald pair as other success badges.
  success:
    'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  error: 'bg-destructive/10 text-destructive',
};

function pluralizeErrors(errorCount: number) {
  return `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`;
}

function getPillContent(status: ResponseStatusValue): {
  tone: PillTone;
  label: string;
  meta?: string;
} {
  switch (status.state) {
    case 'idle':
      return { tone: 'idle', label: 'Not run' };
    case 'running':
      return { tone: 'busy', label: 'Running…' };
    case 'live':
      return { tone: 'busy', label: 'Live' };
    case 'success':
      return {
        tone: 'success',
        label: 'Success',
        meta: [
          formatDuration(status.durationMs),
          status.sizeBytes !== null ? formatSize(status.sizeBytes) : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'graphql-error':
      return {
        tone: 'error',
        label: 'GraphQL error',
        meta: `${pluralizeErrors(status.errorCount)} · ${formatDuration(status.durationMs)}`,
      };
    case 'failed':
      return {
        tone: 'error',
        label: status.httpStatus ? `Failed (${status.httpStatus})` : 'Failed',
        meta: formatDuration(status.durationMs),
      };
    default:
      return { tone: 'idle', label: 'Not run' };
  }
}

export default function ResponseStatus() {
  const status = useResponseStatus();
  // Before the first run the empty state already says so: no pill.
  if (status.state === 'idle') {
    return null;
  }

  const { tone, label, meta } = getPillContent(status);

  return (
    <span
      role="status"
      aria-live="polite"
      className="flex min-w-0 items-center gap-2"
    >
      <span
        data-testid="graphql-response-status"
        className={cn(
          'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 font-semibold text-xs',
          PILL_TONE_CLASSES[tone],
        )}
      >
        {tone !== 'idle' && (
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-current"
          />
        )}
        {label}
      </span>
      {meta && (
        <span className="truncate text-muted-foreground text-xs">{meta}</span>
      )}
    </span>
  );
}

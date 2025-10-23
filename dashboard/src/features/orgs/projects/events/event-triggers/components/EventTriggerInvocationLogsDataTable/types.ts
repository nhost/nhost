import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Dispatch, SetStateAction } from 'react';

export interface EventTriggerInvocationLogsDataTableMeta {
  selectedLog: EventInvocationLogEntry | null;
  setSelectedLog: Dispatch<SetStateAction<EventInvocationLogEntry | null>>;
  addPendingSkeleton: () => string;
  removePendingSkeleton: (id: string) => void;
  refetchInvocations: () => Promise<unknown> | void;
  retryTimeoutSeconds: number;
}

import type { Dispatch, SetStateAction } from 'react';
import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';

export interface EventTriggerInvocationLogsDataTableMeta {
  selectedLog: EventInvocationLogEntry | null;
  setSelectedLog: Dispatch<SetStateAction<EventInvocationLogEntry | null>>;
  isRedeliverPending: boolean;
  setIsRedeliverPending: Dispatch<SetStateAction<boolean>>;
  refetchInvocations: () => Promise<unknown> | undefined;
  retryTimeoutSeconds: number;
}

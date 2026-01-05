import type { EventInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/eventInvocationLogEntry';
import type { Dispatch, SetStateAction } from 'react';

export interface EventTriggerInvocationLogsDataTableMeta {
  selectedLog: EventInvocationLogEntry | null;
  setSelectedLog: Dispatch<SetStateAction<EventInvocationLogEntry | null>>;
  isRedeliverPending: boolean;
  setIsRedeliverPending: Dispatch<SetStateAction<boolean>>;
  refetchInvocations: () => Promise<unknown> | undefined;
  retryTimeoutSeconds: number;
}

import type { CronTriggerInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/cronTriggerInvocationLogEntry';
import type { Dispatch, SetStateAction } from 'react';

export interface CronTriggerInvocationLogsDataTableMeta {
  selectedLog: CronTriggerInvocationLogEntry | null;
  setSelectedLog: Dispatch<
    SetStateAction<CronTriggerInvocationLogEntry | null>
  >;
  isRedeliverPending: boolean;
  setIsRedeliverPending: Dispatch<SetStateAction<boolean>>;
  refetchInvocations: () => Promise<unknown> | void;
  retryTimeoutSeconds: number;
}

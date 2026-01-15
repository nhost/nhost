import type { Dispatch, SetStateAction } from 'react';
import type { CronTriggerInvocationLogEntry } from '@/utils/hasura-api/generated/schemas/cronTriggerInvocationLogEntry';

export interface CronTriggerInvocationLogsDataTableMeta {
  selectedLog: CronTriggerInvocationLogEntry | null;
  setSelectedLog: Dispatch<
    SetStateAction<CronTriggerInvocationLogEntry | null>
  >;
}

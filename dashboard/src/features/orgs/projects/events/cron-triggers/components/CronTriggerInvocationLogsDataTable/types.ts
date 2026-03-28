import type { Dispatch, SetStateAction } from 'react';
import type { InvocationLogEntry } from '@/utils/hasura-api/generated/schemas';

export interface CronTriggerInvocationLogsDataTableMeta {
  selectedLog: InvocationLogEntry | null;
  setSelectedLog: Dispatch<SetStateAction<InvocationLogEntry | null>>;
}

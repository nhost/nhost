import type { Dispatch, SetStateAction } from 'react';
import type { InvocationLogEntry } from '@/utils/hasura-api/generated/schemas/invocationLogEntry';

export interface OneOffInvocationLogsDataTableMeta {
  selectedLog: InvocationLogEntry | null;
  setSelectedLog: Dispatch<SetStateAction<InvocationLogEntry | null>>;
}

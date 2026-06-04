import {
  highlightLog,
  type SearchRange,
} from '@/features/orgs/projects/logs/components/LogsBody/highlightLog';
import { getServiceStyle } from '@/features/orgs/projects/logs/components/LogsBody/serviceStyle';
import {
  SEVERITY_LABEL,
  SEVERITY_TEXT,
  detectSeverity,
} from '@/features/orgs/projects/logs/components/LogsBody/severity';
import type { LogEntry } from '@/features/orgs/projects/logs/components/LogsBody/types';
import { cn } from '@/lib/utils';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useMemo } from 'react';

export const ACTIONS_WIDTH = 44;
export const TIMESTAMP_WIDTH = 145;
export const LOG_LEVEL_WIDTH = 80;
export const SERVICE_WIDTH = 110;
export const LOG_MIN_WIDTH = 300;
export const LOG_CHAR_WIDTH = 7.5;
export const LOG_CELL_PADDING = 16;
export const ROW_HEIGHT = 36;

export interface LogsTableMeta {
  rangesByRow: Map<number, SearchRange[]>;
}

function DateCell({ getValue }: { getValue: () => string }) {
  return (
    <span className="font-mono text-[0.75rem] leading-[0.875rem]">
      {format(new Date(getValue()), 'yyyy-MM-dd HH:mm:ss')}
    </span>
  );
}

function TextCell({ row, getValue, table }: CellContext<LogEntry, string>) {
  const meta = table.options.meta as LogsTableMeta | undefined;
  const ranges = meta?.rangesByRow.get(row.index);
  const text = getValue();
  const content = useMemo(() => highlightLog(text, ranges), [text, ranges]);
  return (
    <span className="font-mono text-[0.75rem] leading-[0.875rem]">
      {content}
    </span>
  );
}

function LogLevelCell({ row }: CellContext<LogEntry, string>) {
  const severity = detectSeverity(row.original.log);
  return (
    <span
      className={cn(
        'font-mono text-[11px] font-semibold uppercase tracking-wide tabular-nums',
        SEVERITY_TEXT[severity],
      )}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

function ServiceCell({ getValue }: { getValue: () => string }) {
  const service = getValue();
  const { label, className } = getServiceStyle(service);

  return (
    <span
      title={service}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 font-mono text-xs-',
        className,
      )}
    >
      {label}
    </span>
  );
}

export const logsColumns: ColumnDef<LogEntry, string>[] = [
  {
    id: 'timestamp',
    accessorKey: 'timestamp',
    cell: DateCell,
    size: TIMESTAMP_WIDTH,
    header: () => 'Timestamp',
  },
  {
    id: 'log_level',
    accessorKey: 'log',
    cell: LogLevelCell,
    size: LOG_LEVEL_WIDTH,
    header: () => 'Level',
  },
  {
    id: 'service',
    accessorKey: 'service',
    cell: ServiceCell,
    size: SERVICE_WIDTH,
    header: () => 'Service',
  },
  {
    id: 'log',
    accessorKey: 'log',
    cell: TextCell,
    header: () => 'Log',
    minSize: LOG_MIN_WIDTH,
    maxSize: 0,
    size: 0,
  },
];

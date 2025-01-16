import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import type {
  GetLogsSubscriptionSubscription,
  GetProjectLogsQuery,
} from '@/generated/graphql';
import type { QueryResult, SubscriptionResult } from '@apollo/client';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import type { PropsWithChildren } from 'react';
import { useMemo, useRef } from 'react';

export interface LogsBodyProps {
  /**
   * The query result
   */
  logsData:
    | QueryResult<GetProjectLogsQuery>['data']
    | SubscriptionResult<GetLogsSubscriptionSubscription>['data'];
  /**
   * Determines whether or not the query or subscription is loading
   */
  loading: boolean;
  /**
   * Optional error message
   */
  error?: Error;
}

export function LogsBodyCustomMessage({
  children,
}: PropsWithChildren<unknown>) {
  return (
    <TableContainer className="h-full w-full">
      <Table stickyHeader aria-label="sticky table">
        <TableBody>
          <TableRow>
            <TableCell
              className="p-2.5"
              align="left"
              padding="none"
              sx={{ backgroundColor: 'background.paper' }}
            >
              {children}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DateCell({ getValue }: { getValue: () => string }) {
  return (
    <Text className="font-mono text-xs-">
      {format(new Date(getValue()), 'yyyy-MM-dd HH:mm:ss')}
    </Text>
  );
}

function TextCell({ getValue }: { getValue: () => string }) {
  return <Text className="font-mono text-xs-">{getValue()}</Text>;
}

export default function LogsBody({ logsData, loading, error }: LogsBodyProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const columns = useMemo(
    () => [
      {
        id: 'timestamp',
        accessorKey: 'timestamp',
        cell: DateCell,
        size: 140,
        header: () => 'Timestamp',
      },
      {
        id: 'service',
        accessorKey: 'service',
        cell: TextCell,
        size: 80,
        header: () => 'Service',
      },
      {
        id: 'log',
        accessorKey: 'log',
        cell: TextCell,
        header: () => 'Log',
        minSize: 300,
        maxSize: 0,
        size: 0,
      },
    ],
    [],
  );

  const data = useMemo(
    () =>
      logsData?.logs
        ? [...logsData.logs].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
        : [],
    [logsData],
  );

  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      size: 0,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 63,
    overscan: 50,
  });

  if (loading && !error) {
    return (
      <TableContainer className="h-full w-full px-4 py-2">
        <ActivityIndicator
          delay={500}
          className="mx-auto"
          label="Loading logs..."
        />
      </TableContainer>
    );
  }

  if (error) {
    return (
      <LogsBodyCustomMessage>
        <Text color="error" className="truncate font-mono text-xs- font-normal">
          {error?.message.includes('the query time range exceeds the limit')
            ? 'The query time range exceeds the limit, please select a shorter range.'
            : error?.message}
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  if (logsData?.logs?.length === 0) {
    return (
      <LogsBodyCustomMessage>
        <Text className="truncate font-mono text-xs- font-normal">
          There are no logs for the selected period.
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  return (
    <TableContainer className="flex h-full w-full flex-col overflow-auto">
      <Table ref={tableRef} stickyHeader className="w-full table-fixed">
        <TableHead>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="w-full">
              {headerGroup.headers.map((header) => (
                <TableCell
                  scope="col"
                  className="min-h-[38px] flex-auto p-2 text-left font-display text-xs- font-semibold"
                  key={header.id}
                  align="left"
                  padding="none"
                  style={{
                    width: header.getSize() || 'auto',
                    minWidth: !header.getSize() ? 300 : 'initial',
                  }}
                  sx={{ backgroundColor: 'background.paper' }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>

        <TableBody
          style={{
            width: '100%',
            height: rowVirtualizer.getTotalSize(),
          }}
          className="w-full"
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <TableRow key={row.index}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    component="td"
                    className="break-words px-2 py-2.5 align-top text-xs- font-normal tracking-tight"
                    style={{
                      width: cell.column.getSize() || 'auto',
                      minWidth: !cell.column.getSize() ? 300 : 'initial',
                    }}
                    sx={{ backgroundColor: 'background.paper' }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

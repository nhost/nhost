import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { cn } from '@/lib/utils';

export interface MetricTableColumn<Row> {
  key: string;
  label: string;
  widthClass?: string;
  alignRight?: boolean;
  render: (row: Row) => ReactNode;
}

export interface MetricTableProps<Row> {
  columns: Array<MetricTableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  emptyLabel?: string;
  maxRows?: number;
  className?: string;
}

export default function MetricTable<Row>({
  columns,
  rows,
  rowKey,
  emptyLabel = 'No data available.',
  maxRows,
  className,
}: MetricTableProps<Row>) {
  const visibleRows = maxRows != null ? rows.slice(0, maxRows) : rows;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {visibleRows.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.widthClass,
                      col.alignRight && 'text-right',
                    )}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => (
                <TableRow key={rowKey(row, rowIndex)}>
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        col.alignRight && 'text-right font-mono tabular-nums',
                      )}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

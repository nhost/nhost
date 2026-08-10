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
  alignRight?: boolean;
  render: (row: Row) => ReactNode;
}

export interface MetricTableProps<Row> {
  columns: Array<MetricTableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  emptyLabel?: string;
  className?: string;
}

export default function MetricTable<Row>({
  columns,
  rows,
  rowKey,
  emptyLabel = 'No data available.',
  className,
}: MetricTableProps<Row>) {
  return (
    <div className={cn('flex flex-1 flex-col gap-2', className)}>
      {rows.length === 0 ? (
        <div className="flex min-h-[260px] flex-1 items-center justify-center">
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
                    className={cn(col.alignRight && 'text-right')}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
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

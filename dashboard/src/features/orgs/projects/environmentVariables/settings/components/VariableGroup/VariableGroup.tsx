import type { ReactNode } from 'react';
import { Table, TableBody } from '@/components/ui/v3/table';

export interface VariableGroupProps {
  /**
   * Small label shown above the box.
   */
  label?: string;
  /**
   * The rows (`TableRow`s) of the group.
   */
  children: ReactNode;
}

// Variables in a bordered, softly filled box with rounded corners, optionally
// under a small label. The first column has the same width in every box, so
// the values line up across groups.
export default function VariableGroup({ label, children }: VariableGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </p>
      )}
      <div className="overflow-hidden rounded-md border bg-muted/30">
        <Table className="table-fixed [&_td:first-child]:w-1/3 [&_td]:py-0 [&_tr]:h-12">
          <TableBody>{children}</TableBody>
        </Table>
      </div>
    </div>
  );
}

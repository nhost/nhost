import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableRow } from '@/components/ui/v2/TableRow';
import type { PropsWithChildren } from 'react';

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

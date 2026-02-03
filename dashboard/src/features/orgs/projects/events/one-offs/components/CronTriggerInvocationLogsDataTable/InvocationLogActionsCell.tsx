import type { Table as TanStackTable } from '@tanstack/react-table';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Dialog, DialogTrigger } from '@/components/ui/v3/dialog';
import type { CronTriggerInvocationLogEntry } from '@/utils/hasura-api/generated/schemas';
import InvocationLogDetailsDialogContent from './InvocationLogDetailsDialogContent';
import type { CronTriggerInvocationLogsDataTableMeta } from './types';

export default function InvocationLogActionsCell({
  row,
  table,
}: {
  row: CronTriggerInvocationLogEntry;
  table: TanStackTable<CronTriggerInvocationLogEntry>;
}) {
  const meta = table.options.meta as CronTriggerInvocationLogsDataTableMeta;

  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        meta.setSelectedLog(null);
      }, 100);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => meta.setSelectedLog(row)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <InvocationLogDetailsDialogContent log={meta.selectedLog} />
      </Dialog>
    </div>
  );
}

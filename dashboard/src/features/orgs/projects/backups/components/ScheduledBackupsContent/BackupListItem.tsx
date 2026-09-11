import { ArchiveRestore, Download, Loader2 } from 'lucide-react';
import { format, formatDistanceStrict, parseISO } from 'date-fns';
import { useDialog } from '@/components/common/DialogProvider';
import { IconButton } from '@/components/ui/v3/icon-button';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  BACKUP_OPERATION_COPY,
  type BackupOperation,
} from '@/features/orgs/projects/backups/components/common/backup-operation';
import { useDownloadBackup } from '@/features/orgs/projects/backups/hooks/useDownloadBackup';
import type { Backup } from '@/types/application';
import { prettifySize } from '@/utils/prettifySize';
import RestoreBackupModal from './RestoreBackupModal';

export interface BackupListItemProps {
  /**
   * Project ID.
   */
  appId: string;
  /**
   * Backup data.
   */
  backup: Backup;
  sourceProjectName?: string;
  operation?: BackupOperation;
}

export default function BackupListItem({
  appId,
  backup,
  sourceProjectName,
  operation = 'restore',
}: BackupListItemProps) {
  const { id, createdAt, size } = backup;
  const { openDialog, closeDialog } = useDialog();
  const { downloadBackup, loading: loadingPresignedUrl } = useDownloadBackup(
    appId,
    id,
  );
  const operationCopy = BACKUP_OPERATION_COPY[operation].backupList;

  function restoreBackup() {
    openDialog({
      title: operationCopy.dialogTitle,
      component: (
        <RestoreBackupModal
          backup={backup}
          close={closeDialog}
          sourceAppId={appId}
          sourceProjectName={sourceProjectName}
          operation={operation}
        />
      ),
    });
  }

  return (
    <TableRow>
      <TableCell className="text-xs">
        {format(parseISO(createdAt), 'yyyy-MM-dd HH:mm:ss')}
      </TableCell>
      <TableCell className="text-xs">{prettifySize(size)}</TableCell>
      <TableCell className="text-xs">
        {formatDistanceStrict(new Date(createdAt), new Date(), {
          addSuffix: true,
        })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-row justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon={loadingPresignedUrl ? Loader2 : Download}
                iconClassName={loadingPresignedUrl ? 'animate-spin' : ''}
                aria-label="Download"
                disabled={loadingPresignedUrl}
                onClick={downloadBackup}
              />
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon={ArchiveRestore}
                aria-label={operationCopy.actionButtonText}
                onClick={restoreBackup}
              />
            </TooltipTrigger>
            <TooltipContent>{operationCopy.actionButtonText}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

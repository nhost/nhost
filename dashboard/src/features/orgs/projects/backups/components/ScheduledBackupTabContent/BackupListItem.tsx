import { format, formatDistanceStrict, parseISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  BACKUP_OPERATION_COPY,
  type BackupOperation,
} from '@/features/orgs/projects/backups/components/common/backup-operation';
import { useGetBackupPresignedUrlLazyQuery } from '@/generated/graphql';
import type { Backup } from '@/types/application';
import { prettifySize } from '@/utils/prettifySize';
import { triggerToast } from '@/utils/toast';
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
  const [fetchPresignedUrl, { loading: loadingPresignedUrl }] =
    useGetBackupPresignedUrlLazyQuery({
      variables: {
        appId,
        backupId: id,
      },
    });
  const operationCopy = BACKUP_OPERATION_COPY[operation].backupList;

  async function downloadBackup() {
    const { data: presignedUrlData, error } = await fetchPresignedUrl();

    if (error) {
      triggerToast(
        'An error occurred while fetching the presigned URL. Please try again later.',
      );

      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    window.open(presignedUrlData?.getBackupPresignedUrl.url, '_blank');
  }

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
      <TableCell
        className={twMerge('text-right', !loadingPresignedUrl && 'pl-8')}
      >
        <div className="flex flex-row justify-end gap-2">
          <ButtonWithLoading
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary"
            onClick={downloadBackup}
            loading={loadingPresignedUrl}
          >
            Download
          </ButtonWithLoading>

          <Button
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary"
            onClick={restoreBackup}
          >
            {operationCopy.actionButtonText}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

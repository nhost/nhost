import { format, formatDistanceStrict, parseISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import type { Backup } from '@/types/application';
import { useGetBackupPresignedUrlLazyQuery } from '@/utils/__generated__/graphql';
import { prettifySize } from '@/utils/prettifySize';
import { triggerToast } from '@/utils/toast';
import RestoreBackupModal from './RestoreBackupModal';

export interface BackupListItemProps {
  /**
   * Source project ID.
   */
  sourceAppId: string;
  /**
   * Backup data.
   */
  backup: Backup;
  sourceProjectName?: string;
  dialogTitle?: string;
  operationLabel?: 'restore' | 'import';
  submitButtonText?: string;
}

export default function BackupListItem({
  sourceAppId,
  backup,
  sourceProjectName,
  dialogTitle = 'Restore Backup',
  operationLabel = 'restore',
  submitButtonText,
}: BackupListItemProps) {
  const { id, createdAt, size } = backup;
  const { openDialog, closeDialog } = useDialog();
  const [fetchPresignedUrl, { loading: loadingPresignedUrl }] =
    useGetBackupPresignedUrlLazyQuery({
      variables: {
        appId: sourceAppId,
        backupId: id,
      },
    });

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
      title: dialogTitle,
      component: (
        <RestoreBackupModal
          backup={backup}
          close={closeDialog}
          sourceAppId={sourceAppId}
          sourceProjectName={sourceProjectName}
          operationLabel={operationLabel}
          submitButtonText={submitButtonText}
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
            Restore
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

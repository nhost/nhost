import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v2/Button';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableRow } from '@/components/ui/v2/TableRow';
import { RestoreBackupModal } from '@/features/projects/backups/components/RestoreBackupModal';
import type { Backup } from '@/types/application';
import { useGetBackupPresignedUrlLazyQuery } from '@/utils/__generated__/graphql';
import { prettifySize } from '@/utils/prettifySize';
import { triggerToast } from '@/utils/toast';
import { format, formatDistanceStrict, parseISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export interface BackupListItemProps {
  /**
   * Project ID.
   */
  projectId: string;
  /**
   * Backup data.
   */
  backup: Backup;
}

export default function BackupListItem({
  projectId,
  backup,
}: BackupListItemProps) {
  const { id, createdAt, size } = backup;
  const { openDialog, closeDialog } = useDialog();
  const [fetchPresignedUrl, { loading: loadingPresignedUrl }] =
    useGetBackupPresignedUrlLazyQuery({
      variables: {
        appId: projectId,
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

    window.open(presignedUrlData.getBackupPresignedUrl.url, '_blank');
  }

  function restoreBackup() {
    openDialog({
      title: 'Restore Backup',
      component: <RestoreBackupModal backup={backup} close={closeDialog} />,
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
        className={twMerge(
          'grid grid-flow-col justify-end gap-2',
          !loadingPresignedUrl && 'pl-8',
        )}
      >
        <Button
          variant="borderless"
          onClick={downloadBackup}
          loading={loadingPresignedUrl}
        >
          Download
        </Button>

        <Button variant="borderless" onClick={restoreBackup}>
          Restore
        </Button>
      </TableCell>
    </TableRow>
  );
}

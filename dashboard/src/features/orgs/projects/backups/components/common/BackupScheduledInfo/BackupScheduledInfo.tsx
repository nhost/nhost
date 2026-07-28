import { memo } from 'react';
import { Button } from '@/components/ui/v3/button';
import { DialogFooter } from '@/components/ui/v3/dialog';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  BACKUP_OPERATION_COPY,
  type BackupOperation,
} from '@/features/orgs/projects/backups/components/common/backup-operation';

interface Props {
  onClose: VoidFunction;
  orgSlug?: string;
  subdomain?: string;
  operation?: BackupOperation;
}

function BackupScheduledInfo({
  onClose,
  orgSlug,
  subdomain,
  operation = 'restore',
}: Props) {
  const operationLabel =
    BACKUP_OPERATION_COPY[operation].scheduledOperationLabel;
  return (
    <>
      <p>
        Your backup {operationLabel} has been scheduled successfully and will
        start shortly.
      </p>
      {orgSlug && subdomain && (
        <p>
          To follow its process go to the{' '}
          <TextLink
            href={`/orgs/${orgSlug}/projects/${subdomain}/logs`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Logs page
          </TextLink>{' '}
          and select the service &quot;Backup Jobs&quot; to see the{' '}
          {operationLabel} logs.
        </p>
      )}
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

export default memo(BackupScheduledInfo);

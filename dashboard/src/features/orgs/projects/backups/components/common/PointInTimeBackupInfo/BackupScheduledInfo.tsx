import { Button } from '@/components/ui/v3/button';
import { DialogFooter } from '@/components/ui/v3/dialog';
import TextLink from '@/features/orgs/projects/common/components/TextLink/TextLink';
import { memo } from 'react';

interface Props {
  onClose: () => void;
  orgSlug: string;
  subdomain: string;
}
//
function BackupScheduledInfo({ onClose, orgSlug, subdomain }: Props) {
  return (
    <>
      <p>Your backup has been scheduled successfully and will start shortly.</p>
      <p>
        To follow its process go to the{' '}
        <TextLink href={`/orgs/${orgSlug}/projects/${subdomain}/logs`}>
          Logs page
        </TextLink>{' '}
        and select the service &quot;Backup Jobs&quot; to see the restore logs.
      </p>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </>
  );
}

export default memo(BackupScheduledInfo);

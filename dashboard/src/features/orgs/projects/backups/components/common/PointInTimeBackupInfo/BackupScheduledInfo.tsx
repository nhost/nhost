import { Button } from '@/components/ui/v3/button';
import { DialogFooter } from '@/components/ui/v3/dialog';
import Link from 'next/link';
import type { PropsWithChildren } from 'react';
import { memo } from 'react';

function LogsLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <Link
      href={href}
      className="text-[0.9375rem] leading-[1.375rem] text-[#0052cd] hover:underline dark:text-[#3888ff]"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </Link>
  );
}

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
        <LogsLink href={`/orgs/${orgSlug}/projects/${subdomain}/logs`}>
          Logs page
        </LogsLink>{' '}
        and select the service &quot;Backup Job&quot; to see the restore logs.
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

import usePiTRBaseBackups from '@/features/orgs/hooks/usePiTRBaseBackups/usePiTRBaseBackups';
import { cn, isEmptyValue } from '@/lib/utils';
import { Info, SquareArrowUpRightIcon } from 'lucide-react';
import Link from 'next/link';
import EarliestBackup from './EarliestBackup';
import RestoreBackupDialogButton from './RestoreBackupDialogButton';

function LearnMoreAboutPiTRLink() {
  return (
    <Link
      href="https://docs.nhost.io/guides/database/backups#point-in-time-recovery"
      className="flex items-center gap-1 text-[0.9375rem] leading-[1.375rem] text-[#0052cd] hover:underline dark:text-[#3888ff]"
      target="_blank"
      rel="noopener noreferrer"
    >
      Learn more about Point-in-Time Recovery{' '}
      <SquareArrowUpRightIcon className="h-4 w-4" />
    </Link>
  );
}

interface Props {
  appId: string;
  title?: string;
  dialogTitle?: string;
  dialogButtonText?: string;
  dialogTriggerText?: string;
  showLink?: boolean;
}

function PointInTimeBackupInfo({
  appId,
  title,
  dialogTitle = 'Recover your database from a backup',
  dialogButtonText,
  dialogTriggerText,
  showLink = false,
}: Props) {
  const { earliestBackupDate, loading } = usePiTRBaseBackups(appId);

  const disableStartRestoreButton = loading || isEmptyValue(earliestBackupDate);

  return (
    <div className="rounded-lg border border-[#EAEDF0] dark:border-[#2F363D]">
      <div className="flex w-full flex-col items-start gap-6 p-4">
        <h3 className="leading-[1.375] text-[0.9375]">
          {title || 'Restore your database from a backup'}
        </h3>
        <div className="flex w-full flex-col gap-4">
          <div>
            <p className="text-[0.75rem]">Backups are available from</p>
            <EarliestBackup dateTime={earliestBackupDate} loading={loading} />
          </div>
          <div>
            <p className="text-[0.75rem]">Latest backup</p>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <p>
                Restore available up to current time. System will restore up to
                closest available target time if exact time unavailable.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div
        className={cn(
          'flex w-full items-center border-t border-[#EAEDF0] p-4 dark:border-[#2F363D]',
          { 'justify-between': showLink, 'justify-end': !showLink },
        )}
      >
        {showLink && <LearnMoreAboutPiTRLink />}
        <RestoreBackupDialogButton
          disabled={disableStartRestoreButton}
          earliestBackupDate={earliestBackupDate}
          title={dialogTitle}
          fromAppId={appId}
          dialogButtonText={dialogButtonText}
          dialogTriggerText={dialogTriggerText}
        />
      </div>
    </div>
  );
}

export default PointInTimeBackupInfo;

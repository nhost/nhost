import { Button } from '@/components/ui/v3/button';
import usePiTRBaseBackups from '@/features/orgs/hooks/usePiTRBaseBackups/usePiTRBaseBackups';
import { isEmptyValue } from '@/lib/utils';
import { Info } from 'lucide-react';
import EarliestBackup from './EarliestBackup';

interface Props {
  appId?: string;
  title?: string;
}

function PointInTimeBackupInfo({ appId, title }: Props) {
  const { earliestBackupDate, loading } = usePiTRBaseBackups(appId);

  const disableStartRestoreButton = loading || isEmptyValue(earliestBackupDate);
  return (
    /* Move this part to a different component */
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
                Backups available through current time. If unavailable, the
                closest possible time will be selected.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex w-full items-center justify-end border-t border-[#EAEDF0] p-4 dark:border-[#2F363D]">
        <Button disabled={disableStartRestoreButton}>Start restore</Button>
      </div>
    </div>
  );
}

export default PointInTimeBackupInfo;

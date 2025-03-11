import { useIsPiTREnabledLazy } from '@/features/orgs/hooks/useIsPiTREnabledLazy';
import { PointInTimeBackupInfo } from '@/features/orgs/projects/backups/components/common/PointInTimeBackupInfo';
import PiTRNotEnabledOnSourceProject from './PiTRNotEnabledOnSourceProject';

interface Props {
  appId: string;
  title?: string;
}

function SourceProjectBackupInfo({ appId, title }: Props) {
  const { isPiTREnabled } = useIsPiTREnabledLazy(appId);
  return (
    <>
      {isPiTREnabled && (
        <PointInTimeBackupInfo
          appId={appId}
          title={title}
          dialogTitle="Import backup"
          dialogButtonText="Import backup"
          dialogTriggerText="Start import"
        />
      )}
      {!isPiTREnabled && <PiTRNotEnabledOnSourceProject />}
    </>
  );
}

export default SourceProjectBackupInfo;

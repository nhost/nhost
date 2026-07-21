import { useIsPiTREnabledLazy } from '@/features/orgs/hooks/useIsPiTREnabledLazy';
import { PointInTimeBackupInfo } from '@/features/orgs/projects/backups/components/common/PointInTimeBackupInfo';
import LogicalBackupImport from './LogicalBackupImport';

interface Props {
  appId: string;
  sourceProjectName: string;
  title?: string;
}

function SourceProjectBackupInfo({ appId, sourceProjectName, title }: Props) {
  const { isPiTREnabled } = useIsPiTREnabledLazy(appId);
  return isPiTREnabled ? (
    <PointInTimeBackupInfo
      appId={appId}
      title={title}
      dialogTitle="Import backup"
      dialogButtonText="Import backup"
      dialogTriggerText="Start import"
    />
  ) : (
    <LogicalBackupImport
      sourceAppId={appId}
      sourceProjectName={sourceProjectName}
      title={title}
    />
  );
}

export default SourceProjectBackupInfo;

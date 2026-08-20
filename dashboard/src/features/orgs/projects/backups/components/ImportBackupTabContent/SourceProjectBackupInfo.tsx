import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPiTREnabledLazy } from '@/features/orgs/hooks/useIsPiTREnabledLazy';
import { PointInTimeBackupInfo } from '@/features/orgs/projects/backups/components/common/PointInTimeBackupInfo';
import LogicalBackupImport from './LogicalBackupImport';

interface Props {
  appId: string;
  sourceProjectName: string;
  title?: string;
}

function SourceProjectBackupInfo({ appId, sourceProjectName, title }: Props) {
  const { isPiTREnabled, loading } = useIsPiTREnabledLazy(appId);

  if (loading) {
    return <Spinner>Loading backup settings...</Spinner>;
  }

  return isPiTREnabled ? (
    <PointInTimeBackupInfo appId={appId} title={title} operation="import" />
  ) : (
    <LogicalBackupImport
      sourceAppId={appId}
      sourceProjectName={sourceProjectName}
      title={title}
    />
  );
}

export default SourceProjectBackupInfo;

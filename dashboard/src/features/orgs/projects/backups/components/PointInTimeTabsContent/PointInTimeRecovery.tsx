import { useProject } from '@/features/orgs/projects/hooks/useProject';
import PointInTimeBackupInfo from './PointInTimeBackupInfo';
import RecoveryRetentionPeriod from './RecoveryRetentionPeriod';

function PointInTimeRecovery() {
  const { project } = useProject();
  return (
    <div className="flex flex-col gap-[1.875rem]">
      <RecoveryRetentionPeriod />
      <PointInTimeBackupInfo appId={project?.id} />
    </div>
  );
}

export default PointInTimeRecovery;

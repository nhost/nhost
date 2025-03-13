import { PointInTimeBackupInfo } from '@/features/orgs/projects/backups/components/common/PointInTimeBackupInfo';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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

import { PointInTimeBackupInfo } from '@/features/orgs/projects/backups/components/common/PointInTimeBackupInfo';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import RecoveryRetentionPeriod from './RecoveryRetentionPeriod';
import RestoreRecommendationNote from './RestoreRecommendationNote';

function PointInTimeRecovery() {
  const { project } = useProject();
  return (
    <div className="flex flex-col gap-[1.875rem]">
      <RecoveryRetentionPeriod />
      <RestoreRecommendationNote />
      <PointInTimeBackupInfo appId={project?.id} showLink />
    </div>
  );
}

export default PointInTimeRecovery;

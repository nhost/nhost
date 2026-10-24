import { useState } from 'react';
import { useScheduleDeployment } from '@/features/orgs/projects/deployments/hooks/useScheduleDeployment';
import {
  getRedeployWarning,
  type RedeployWarning,
} from '@/features/orgs/projects/deployments/utils/getRedeployWarning';
import type { UnifiedDeploymentRowFragment } from '@/generated/graphql';

/**
 * Redeploys `deployment` right away when it is the live commit or nothing is
 * live. Otherwise `redeploy` sets `warning`, and the deployment is only
 * scheduled once the user confirms.
 */
export default function useRedeployDeployment(
  deployment: UnifiedDeploymentRowFragment,
  liveDeployment: UnifiedDeploymentRowFragment | null,
) {
  const [warning, setWarning] = useState<RedeployWarning | null>(null);
  const { schedule, scheduling } = useScheduleDeployment();

  async function redeploy() {
    const nextWarning = getRedeployWarning(deployment, liveDeployment);
    if (nextWarning) {
      setWarning(nextWarning);
      return;
    }
    await schedule(deployment);
  }

  async function confirm() {
    if (await schedule(deployment)) {
      setWarning(null);
    }
  }

  return {
    redeploy,
    confirm,
    cancel: () => setWarning(null),
    warning,
    scheduling,
  };
}

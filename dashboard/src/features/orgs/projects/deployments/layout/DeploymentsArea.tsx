import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import DeploymentsRouteTabs from '@/features/orgs/projects/deployments/layout/DeploymentsRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's Deployments
 * pages still reach settings. Whatever the page hands over is rendered as-is
 * below the tabs.
 */
export default function DeploymentsArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<DeploymentsRouteTabs />}>{children}</AreaLayout>;
}

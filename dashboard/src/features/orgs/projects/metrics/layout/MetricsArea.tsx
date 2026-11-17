import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's Metrics
 * pages still reach settings. Whatever the page hands over is rendered as-is
 * below the tabs.
 */
export default function MetricsArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<MetricsRouteTabs />}>{children}</AreaLayout>;
}

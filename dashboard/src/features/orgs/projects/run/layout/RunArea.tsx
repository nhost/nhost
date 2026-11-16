import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's Run pages
 * still reach settings. Whatever the page hands over is rendered as-is below
 * the tabs.
 */
export default function RunArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<RunRouteTabs />}>{children}</AreaLayout>;
}

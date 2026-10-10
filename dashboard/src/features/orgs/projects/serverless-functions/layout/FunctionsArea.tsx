import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import FunctionsRouteTabs from '@/features/orgs/projects/serverless-functions/layout/FunctionsRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's Functions
 * pages still reach settings. Whatever the page hands over is rendered as-is
 * below the tabs.
 */
export default function FunctionsArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<FunctionsRouteTabs />}>{children}</AreaLayout>;
}

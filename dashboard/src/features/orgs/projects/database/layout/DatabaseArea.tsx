import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import DatabaseRouteTabs from '@/features/orgs/projects/database/layout/DatabaseRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's database
 * pages still reach backups and settings. Whatever the page hands over is
 * rendered as-is below the tabs.
 */
export default function DatabaseArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<DatabaseRouteTabs />}>{children}</AreaLayout>;
}

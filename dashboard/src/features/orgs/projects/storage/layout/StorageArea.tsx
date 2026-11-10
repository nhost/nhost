import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import StorageRouteTabs from '@/features/orgs/projects/storage/layout/StorageRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's Storage
 * pages still reach settings. Whatever the page hands over is rendered as-is
 * below the tabs.
 */
export default function StorageArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<StorageRouteTabs />}>{children}</AreaLayout>;
}

import type { PropsWithChildren } from 'react';
import AIRouteTabs from '@/features/orgs/projects/ai/layout/AIRouteTabs';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';

/**
 * Route tabs above the project-state gate, so a paused project's AI pages
 * still reach settings. Whatever the page hands over is rendered as-is below
 * the tabs.
 */
export default function AIArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<AIRouteTabs />}>{children}</AreaLayout>;
}

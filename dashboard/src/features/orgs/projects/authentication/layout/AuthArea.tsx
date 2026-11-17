import type { PropsWithChildren } from 'react';
import AuthRouteTabs from '@/features/orgs/projects/authentication/layout/AuthRouteTabs';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';

/**
 * Route tabs above the project-state gate, so a paused project's Auth pages
 * still reach settings. Whatever the page hands over is rendered as-is below
 * the tabs.
 */
export default function AuthArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<AuthRouteTabs />}>{children}</AreaLayout>;
}

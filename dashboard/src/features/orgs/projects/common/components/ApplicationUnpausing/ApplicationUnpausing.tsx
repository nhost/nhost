import type { PropsWithChildren } from 'react';
import ProjectStateGuard from '@/features/orgs/layout/OrgLayout/ProjectStateGuard';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';

export default function ApplicationUnpausing({ children }: PropsWithChildren) {
  useProjectRedirectWhenReady({ pollInterval: 2000 });
  return <ProjectStateGuard variant="unpausing">{children}</ProjectStateGuard>;
}

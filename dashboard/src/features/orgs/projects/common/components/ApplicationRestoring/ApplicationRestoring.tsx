import type { PropsWithChildren } from 'react';
import ProjectStateGuard from '@/features/orgs/layout/OrgLayout/ProjectStateGuard';
import { useCheckProvisioning } from '@/features/orgs/projects/common/hooks/useCheckProvisioning';

export default function ApplicationRestoring({ children }: PropsWithChildren) {
  useCheckProvisioning();
  return (
    <ProjectStateGuard variant="unpausing">
      {children}
    </ProjectStateGuard>
  );
}

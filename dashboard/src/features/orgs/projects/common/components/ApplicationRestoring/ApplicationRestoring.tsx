import type { PropsWithChildren } from 'react';
import ProjectStateGuard from '@/features/orgs/layout/OrgLayout/ProjectStateGuard';
import { useCheckProvisioning } from '@/features/orgs/projects/common/hooks/useCheckProvisioning';

function RestoringProvisioningCheck() {
  useCheckProvisioning();
  return null;
}

interface ApplicationRestoringProps extends PropsWithChildren {
  isRestoring?: boolean;
}

export default function ApplicationRestoring({
  children,
  isRestoring = true,
}: ApplicationRestoringProps) {
  return (
    <>
      {isRestoring && <RestoringProvisioningCheck />}
      <ProjectStateGuard variant="unpausing" isActive={isRestoring}>
        {children}
      </ProjectStateGuard>
    </>
  );
}

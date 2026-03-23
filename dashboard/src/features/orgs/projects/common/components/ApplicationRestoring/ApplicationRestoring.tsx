import type { PropsWithChildren } from 'react';
import ProjectStateOverlay from '@/features/orgs/layout/OrgLayout/ProjectStateOverlay';
import { useCheckProvisioning } from '@/features/orgs/projects/common/hooks/useCheckProvisioning';

export default function ApplicationRestoring({ children }: PropsWithChildren) {
  useCheckProvisioning();
  return (
    <>
      <ProjectStateOverlay variant="unpausing" />
      {children}
    </>
  );
}

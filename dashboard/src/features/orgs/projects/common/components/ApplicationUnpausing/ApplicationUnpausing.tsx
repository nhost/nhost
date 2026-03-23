import type { PropsWithChildren } from 'react';
import ProjectStateOverlay from '@/features/orgs/layout/OrgLayout/ProjectStateOverlay';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';

export default function ApplicationUnpausing({ children }: PropsWithChildren) {
  useProjectRedirectWhenReady({ pollInterval: 2000 });
  return (
    <>
      <ProjectStateOverlay variant="unpausing" />
      {children}
    </>
  );
}

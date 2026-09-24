import type { PropsWithChildren } from 'react';
import { OrgStatus } from '@/features/orgs/components/OrgStatus';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';
import { OrganizationGuard } from '@/features/orgs/layout/OrganizationGuard';
import { ProjectGuard } from '@/features/orgs/layout/ProjectGuard';

/**
 * Everything a project page needs before it may render: a signed-in session,
 * a loaded organization, a loaded project.
 */
export default function ProjectScope({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <OrganizationGuard>
        <OrgStatus />
        <div className="relative min-h-0 flex-1">
          <ProjectGuard>{children}</ProjectGuard>
        </div>
      </OrganizationGuard>
    </AuthGuard>
  );
}

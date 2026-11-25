import type { PropsWithChildren } from 'react';
import { OrgStatusRedirect } from '@/features/orgs/components/OrgStatus';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';
import { OrganizationGuard } from '@/features/orgs/guards/OrganizationGuard';
import { ProjectGuard } from '@/features/orgs/guards/ProjectGuard';
import { useClearQueryCacheOnProjectChange } from '@/features/orgs/projects/common/hooks/useClearQueryCacheOnProjectChange';

/**
 * Everything a project page needs before it may render: a signed-in session,
 * a loaded organization, a loaded project. Its content region scrolls the
 * page, unless a layout inside it scrolls a narrower region.
 */
export default function ProjectScope({ children }: PropsWithChildren) {
  useClearQueryCacheOnProjectChange();

  return (
    <AuthGuard>
      <OrganizationGuard>
        <OrgStatusRedirect />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <ProjectGuard>{children}</ProjectGuard>
        </div>
      </OrganizationGuard>
    </AuthGuard>
  );
}

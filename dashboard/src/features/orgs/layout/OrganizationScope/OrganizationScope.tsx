import type { PropsWithChildren } from 'react';
import { OrgStatus } from '@/features/orgs/components/OrgStatus';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';
import { OrganizationGuard } from '@/features/orgs/layout/OrganizationGuard';

/**
 * Everything an organization page needs before it may render: a signed-in
 * session and a loaded organization.
 */
export default function OrganizationScope({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <OrganizationGuard>
        <OrgStatus />
        <div className="relative min-h-0 flex-1">{children}</div>
      </OrganizationGuard>
    </AuthGuard>
  );
}

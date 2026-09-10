import type { PropsWithChildren } from 'react';
import { OrgStatus } from '@/features/orgs/components/OrgStatus';
import { AuthGuard } from '@/features/orgs/layout/AuthGuard';
import { OrganizationGuard } from '@/features/orgs/layout/OrganizationGuard';

/**
 * Everything an organization page needs before it may render: a signed-in
 * session and a loaded organization. Renders nothing of its own.
 */
export default function OrganizationScope({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <OrganizationGuard>
        <OrgStatus />
        {children}
      </OrganizationGuard>
    </AuthGuard>
  );
}

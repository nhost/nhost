import type { PropsWithChildren } from 'react';
import { OrgStatusRedirect } from '@/features/orgs/components/OrgStatus';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';
import { OrganizationGuard } from '@/features/orgs/guards/OrganizationGuard';

/**
 * Everything an organization page needs before it may render: a signed-in
 * session and a loaded organization. Its content region scrolls the page.
 */
export default function OrganizationScope({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <OrganizationGuard>
        <OrgStatusRedirect />
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </OrganizationGuard>
    </AuthGuard>
  );
}

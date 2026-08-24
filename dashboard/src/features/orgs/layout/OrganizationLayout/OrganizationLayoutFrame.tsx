import type { PropsWithChildren } from 'react';
import OrganizationLayoutSidebar from '@/features/orgs/layout/OrganizationLayout/OrganizationLayoutSidebar';

export default function OrganizationLayoutFrame({
  children,
}: PropsWithChildren) {
  return (
    <div className="flex h-full min-w-0 flex-row overflow-hidden">
      <OrganizationLayoutSidebar />
      <main className="relative h-full min-w-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

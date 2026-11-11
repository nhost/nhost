import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MembersHeader } from '@/features/orgs/components/members/components/MembersHeader';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';

export default function OrgMembers() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8">
      <MembersHeader />
      <MembersList />
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>{page}</OrganizationScope>
    </AppLayout>
  );
};

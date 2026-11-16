import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MembersHeader } from '@/features/orgs/components/members/components/MembersHeader';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { OrganizationScope } from '@/features/orgs/guards/OrganizationScope';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export default function OrgMemberInvites() {
  const { replace } = useRouter();
  const { org } = useCurrentOrg();
  const isFree = org?.plan?.isFree;

  useEffect(() => {
    if (org && isFree) {
      replace(`/orgs/${org.slug}/members`);
    }
  }, [org, isFree, replace]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-8">
      <MembersHeader />
      {org && !isFree && <PendingInvites />}
    </div>
  );
}

OrgMemberInvites.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <OrganizationScope>{page}</OrganizationScope>
    </AppLayout>
  );
};

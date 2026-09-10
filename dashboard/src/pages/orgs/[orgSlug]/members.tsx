import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  RouteTabLink,
  RouteTabs,
} from '@/components/ui/v3/route-tabs';
import { AddMemberDialog } from '@/features/orgs/components/members/components/AddMemberDialog';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { PendingInvites } from '@/features/orgs/components/members/components/PendingInvites';
import { OrganizationLayout } from '@/features/orgs/layout/OrganizationLayout';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useGetOrganizationInvitesQuery } from '@/generated/graphql';

type MembersTab = 'members' | 'pending-invites';

export default function OrgMembers() {
  const { org } = useCurrentOrg();
  const isFree = org?.plan?.isFree;
  const members = org?.members ?? [];
  const [activeTab, setActiveTab] = useState<MembersTab>('members');

  const {
    data: { organizationMemberInvites: invites = [] } = {},
    loading: invitesLoading,
    error: getInvitesError,
    refetch: refetchInvites,
  } = useGetOrganizationInvitesQuery({
    variables: { organizationId: org?.id },
    skip: !org || isFree,
  });

  if (getInvitesError) {
    throw getInvitesError;
  }

  const tab = isFree ? 'members' : activeTab;

  return (
    <div className="flex h-full flex-col overflow-auto bg-accent-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-16 pt-8">
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">Members</h1>
            <p className="text-muted-foreground text-sm">
              People in {org?.name} can manage all projects within the
              organization.
            </p>
          </div>

          {!isFree && (
            <AddMemberDialog onInviteSent={() => refetchInvites()} />
          )}
        </div>

        <RouteTabs aria-label="Members section navigation">
          <RouteTabLink
            href="#"
            active={tab === 'members'}
            onClick={(event) => {
              event.preventDefault();
              setActiveTab('members');
            }}
          >
            Members {members.length > 0 && `(${members.length})`}
          </RouteTabLink>

          {!isFree && (
            <RouteTabLink
              href="#"
              active={tab === 'pending-invites'}
              onClick={(event) => {
                event.preventDefault();
                setActiveTab('pending-invites');
              }}
            >
              Pending invites{' '}
              {invites.length > 0 && `(${invites.length})`}
            </RouteTabLink>
          )}
        </RouteTabs>

        {tab === 'members' ? (
          <MembersList />
        ) : (
          <PendingInvites invites={invites} loading={invitesLoading} />
        )}
      </div>
    </div>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return <OrganizationLayout>{page}</OrganizationLayout>;
};

import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { Spinner } from '@/components/ui/v3/spinner';
import { OrgInvite } from '@/features/orgs/components/members/components/OrgInvite';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useGetOrganizationInvitesQuery } from '@/generated/graphql';

const INVITES_PER_PAGE = 25;

export default function PendingInvites() {
  const { org } = useCurrentOrg();
  const isAdmin = useIsOrgAdmin();

  const {
    data: { organizationMemberInvites = [] } = {},
    loading,
    error: getInvitesError,
  } = useGetOrganizationInvitesQuery({
    variables: { organizationId: org?.id },
    skip: !org,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const nrOfPages = Math.max(
    Math.ceil(organizationMemberInvites.length / INVITES_PER_PAGE),
    1,
  );
  const page = Math.min(currentPage, nrOfPages);
  const pageInvites = organizationMemberInvites.slice(
    (page - 1) * INVITES_PER_PAGE,
    page * INVITES_PER_PAGE,
  );

  if (getInvitesError) {
    throw getInvitesError;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col overflow-hidden rounded-md border bg-background">
        {loading && (
          <div className="flex w-full items-center justify-center p-6">
            <Spinner
              size="xs"
              wrapperClassName="flex-row justify-center gap-1.5"
            >
              <span className="text-muted-foreground text-xs">
                Loading pending invites...
              </span>
            </Spinner>
          </div>
        )}

        {!loading && organizationMemberInvites.length > 0 && (
          <div className="flex w-full flex-col divide-y">
            {pageInvites.map((invite) => (
              <div
                key={invite.id}
                className="px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <OrgInvite invite={invite} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        )}

        {!loading && organizationMemberInvites.length === 0 && (
          <div className="flex w-full flex-col items-center justify-center gap-2 p-6 text-muted-foreground">
            <Inbox />
            <p className="text-sm">No pending invites</p>
          </div>
        )}
      </div>

      {!loading && organizationMemberInvites.length > INVITES_PER_PAGE && (
        <Pagination
          totalNrOfPages={nrOfPages}
          currentPageNumber={page}
          totalNrOfElements={organizationMemberInvites.length}
          itemsLabel="invites"
          elementsPerPage={INVITES_PER_PAGE}
          onPrevPageClick={() => setCurrentPage(page - 1)}
          onNextPageClick={() => setCurrentPage(page + 1)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

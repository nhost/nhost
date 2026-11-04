import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { OrgMember } from '@/features/orgs/components/members/components/OrgMember';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

const MEMBERS_PER_PAGE = 25;

export default function MembersList() {
  const { org } = useCurrentOrg();
  const members = org?.members ?? [];
  const isAdmin = useIsOrgAdmin();
  const [currentPage, setCurrentPage] = useState(1);

  const nrOfPages = Math.max(Math.ceil(members.length / MEMBERS_PER_PAGE), 1);
  const page = Math.min(currentPage, nrOfPages);
  const pageMembers = members.slice(
    (page - 1) * MEMBERS_PER_PAGE,
    page * MEMBERS_PER_PAGE,
  );

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col overflow-hidden rounded-md border bg-background">
        {/* Todo add an empty state here */}
        <div className="flex w-full flex-col divide-y">
          {pageMembers.map((member) => (
            <div
              key={member.id}
              className="px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <OrgMember member={member} isAdmin={isAdmin} />
            </div>
          ))}
        </div>
      </div>

      {members.length > MEMBERS_PER_PAGE && (
        <Pagination
          totalNrOfPages={nrOfPages}
          currentPageNumber={page}
          totalNrOfElements={members.length}
          itemsLabel="members"
          elementsPerPage={MEMBERS_PER_PAGE}
          onPrevPageClick={() => setCurrentPage(page - 1)}
          onNextPageClick={() => setCurrentPage(page + 1)}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}

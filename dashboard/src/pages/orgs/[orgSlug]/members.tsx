import { Container } from '@/components/layout/Container';
import { MembersList } from '@/features/orgs/components/members/components/MembersList';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgMembers() {
  return (
    <Container className="">
      <MembersList />
    </Container>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

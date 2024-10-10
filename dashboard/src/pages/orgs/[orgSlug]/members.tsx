import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgMembers() {
  return (
    <Container className="">
      <span>Members</span>
    </Container>
  );
}

OrgMembers.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

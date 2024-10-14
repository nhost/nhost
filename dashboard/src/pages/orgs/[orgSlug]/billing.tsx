import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgBilling() {
  return (
    <Container className="">
      <span>Billing</span>
    </Container>
  );
}

OrgBilling.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

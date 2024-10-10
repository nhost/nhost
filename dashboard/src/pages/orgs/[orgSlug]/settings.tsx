import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgSettings() {
  return (
    <Container className="">
      <span>Settings</span>
    </Container>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

import { Container } from '@/components/layout/Container';
import { GeneralSettings } from '@/features/orgs/components/general/components/GeneralSettings';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function OrgSettings() {
  return (
    <Container className="">
      <GeneralSettings />
    </Container>
  );
}

OrgSettings.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

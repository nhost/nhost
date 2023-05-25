import { Container } from '@/components/layout/Container';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { HasuraConnectionInfo } from '@/features/hasura/overview/components/HasuraConnectionInfo';
import type { ReactElement } from 'react';

export default function HasuraPage() {
  return (
    <Container>
      <HasuraConnectionInfo />
    </Container>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

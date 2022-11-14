import { HasuraData } from '@/components/applications/HasuraData';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import type { ReactElement } from 'react';

export default function HasuraPage() {
  return (
    <Container>
      <HasuraData />
    </Container>
  );
}

HasuraPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};

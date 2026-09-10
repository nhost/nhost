import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import SchemaDiagram from '@/features/orgs/projects/database/schema-diagram/SchemaDiagram';

export default function DatabaseSchemaDiagramPage() {
  return (
    <RetryableErrorBoundary>
      <SchemaDiagram />
    </RetryableErrorBoundary>
  );
}

DatabaseSchemaDiagramPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout mainContainerProps={{ className: 'flex h-full' }}>
      <div className="box flex w-full flex-auto flex-col overflow-hidden bg-default">
        {page}
      </div>
    </ProjectLayout>
  );
};

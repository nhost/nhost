import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
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
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full">
            <div className="box flex w-full flex-auto flex-col overflow-hidden bg-default">
              {page}
            </div>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};

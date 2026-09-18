import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';
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
        <DatabaseArea>
          <ContentPanel>
            <div className="flex h-full">
              <div className="box flex w-full flex-auto flex-col overflow-hidden">
                {page}
              </div>
            </div>
          </ContentPanel>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};

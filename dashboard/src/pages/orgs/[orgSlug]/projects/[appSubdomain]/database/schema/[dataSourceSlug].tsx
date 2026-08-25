import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';
import SchemaDiagram from '@/features/orgs/projects/database/schema-diagram/SchemaDiagram';

export default function DatabaseSchemaDiagramPage() {
  return (
    <RetryableErrorBoundary>
      <SchemaDiagram />
    </RetryableErrorBoundary>
  );
}

DatabaseSchemaDiagramPage.getLayout = function getLayout(page: ReactElement) {
  return getDatabaseLayout(page, {
    contentClassName:
      'box flex w-full flex-auto flex-col overflow-hidden bg-default',
  });
};

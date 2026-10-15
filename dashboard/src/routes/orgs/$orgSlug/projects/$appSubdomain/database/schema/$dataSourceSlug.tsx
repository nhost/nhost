import { createFileRoute } from '@tanstack/react-router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import SchemaDiagram from '@/features/orgs/projects/database/schema-diagram/SchemaDiagram';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/database/schema/$dataSourceSlug',
)({
  component: RouteComponent,
});

function DatabaseSchemaDiagramPage() {
  return (
    <RetryableErrorBoundary>
      <SchemaDiagram />
    </RetryableErrorBoundary>
  );
}

function RouteComponent() {
  return (
    <div className="flex h-full">
      <div className="box flex w-full flex-auto flex-col overflow-hidden">
        <DatabaseSchemaDiagramPage />
      </div>
    </div>
  );
}

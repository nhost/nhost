import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';
import { GraphQLSchemaViewer } from '@/features/orgs/projects/graphql/schema/components/GraphQLSchemaViewer';

export default function GraphQLSchemaPage() {
  return (
    <div className="grid grid-flow-row gap-6 py-8">
      <div>
        <h1 className="font-semibold text-2.5xl">Schema</h1>
        <p className="mt-1 max-w-prose text-pretty text-muted-foreground">
          Browse your project&apos;s GraphQL schema as a given role sees it.
        </p>
      </div>

      <RetryableErrorBoundary>
        <GraphQLSchemaViewer />
      </RetryableErrorBoundary>
    </div>
  );
}

GraphQLSchemaPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <div className="flex min-h-full">
            <div className="mx-auto w-full max-w-5xl px-10">{page}</div>
          </div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};

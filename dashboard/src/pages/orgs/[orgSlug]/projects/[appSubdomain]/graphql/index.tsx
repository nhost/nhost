import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';

// Monaco needs the browser.
const GraphQLPlayground = dynamic(
  () =>
    import(
      '@/features/orgs/projects/graphql/common/components/GraphQLPlayground'
    ).then((mod) => mod.GraphQLPlayground),
  { ssr: false },
);

export default function GraphQLPage() {
  return (
    <RetryableErrorBoundary>
      <GraphQLPlayground />
    </RetryableErrorBoundary>
  );
}

GraphQLPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <div className="graphiql-themed flex h-full flex-col">{page}</div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};

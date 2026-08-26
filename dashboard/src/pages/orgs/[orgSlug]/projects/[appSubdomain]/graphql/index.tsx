import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import '@graphiql/react/dist/style.css';
import 'graphiql/graphiql.min.css';
import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';

const GraphQLPageContent = dynamic(
  () =>
    import(
      '@/features/orgs/projects/graphql/GraphQLPageContent/GraphQLPageContent'
    ),
  { ssr: false },
);

export default function GraphQLPage() {
  return (
    <RetryableErrorBoundary>
      <GraphQLPageContent />
    </RetryableErrorBoundary>
  );
}

GraphQLPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'graphiql-themed flex h-full flex-col',
      }}
    >
      {page}
    </OrgLayout>
  );
};

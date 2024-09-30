import { OrgProjectLayout } from '@/components/layout/OrgProjectLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import '@graphiql/react/dist/style.css';
import 'graphiql/graphiql.min.css';
import type { ReactElement } from 'react';

export default function GraphQLPage() {
  return (
    <RetryableErrorBoundary>
      <span>Graphql</span>
    </RetryableErrorBoundary>
  );
}

GraphQLPage.getLayout = function getLayout(page: ReactElement) {
  return <OrgProjectLayout>{page}</OrgProjectLayout>;
};

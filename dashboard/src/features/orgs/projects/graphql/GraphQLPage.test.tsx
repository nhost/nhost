import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import GraphQLPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/graphql/index';

describe('GraphQLPage', () => {
  it('wraps feature content in the page error boundary', () => {
    expect(GraphQLPage().type).toBe(RetryableErrorBoundary);
  });

  it('retains the GraphiQL page layout styling', () => {
    const layout = GraphQLPage.getLayout(<div />);

    expect(layout.type).toBe(OrgLayout);
    expect(layout.props.mainContainerProps).toEqual({
      className: 'graphiql-themed flex h-full flex-col',
    });
  });
});

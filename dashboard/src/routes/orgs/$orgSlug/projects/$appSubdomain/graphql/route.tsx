import { createFileRoute, Outlet } from '@tanstack/react-router';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql',
)({
  component: GraphQLAreaLayout,
});

function GraphQLAreaLayout() {
  return (
    <GraphQLArea>
      <Outlet />
    </GraphQLArea>
  );
}

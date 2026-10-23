import type { PropsWithChildren } from 'react';
import { AreaLayout } from '@/features/orgs/projects/common/layout/AreaLayout';
import GraphQLRouteTabs from '@/features/orgs/projects/graphql/layout/GraphQLRouteTabs';

/**
 * Route tabs above the project-state gate, so a paused project's GraphQL
 * pages still reach settings. Whatever the page hands over is rendered as-is
 * below the tabs.
 */
export default function GraphQLArea({ children }: PropsWithChildren) {
  return <AreaLayout tabs={<GraphQLRouteTabs />}>{children}</AreaLayout>;
}

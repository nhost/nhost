import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import GraphQLRouteTabs from '@/features/orgs/projects/graphql/layout/GraphQLRouteTabs';

export type GetGraphQLLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getGraphQLLayout(
  page: ReactElement,
  options: GetGraphQLLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <GraphQLRouteTabs />,
  });
}

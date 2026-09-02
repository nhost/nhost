import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import DeploymentsRouteTabs from '@/features/orgs/projects/deployments/layout/DeploymentsRouteTabs';

export type GetDeploymentsLayoutOptions = Omit<
  ProjectLayoutOptions,
  'navigation'
>;

export function getDeploymentsLayout(
  page: ReactElement,
  options: GetDeploymentsLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <DeploymentsRouteTabs />,
  });
}

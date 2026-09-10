import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import AuthRouteTabs from '@/features/orgs/projects/authentication/layout/AuthRouteTabs';

export type GetAuthLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getAuthLayout(
  page: ReactElement,
  options: GetAuthLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <AuthRouteTabs />,
  });
}

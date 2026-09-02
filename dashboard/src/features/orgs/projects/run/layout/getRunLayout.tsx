import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';

export type GetRunLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getRunLayout(
  page: ReactElement,
  options: GetRunLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <RunRouteTabs />,
  });
}

import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import FunctionsRouteTabs from '@/features/orgs/projects/serverless-functions/layout/FunctionsRouteTabs';

export type GetFunctionsLayoutOptions = Omit<
  ProjectLayoutOptions,
  'navigation'
>;

export function getFunctionsLayout(
  page: ReactElement,
  options: GetFunctionsLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <FunctionsRouteTabs />,
  });
}

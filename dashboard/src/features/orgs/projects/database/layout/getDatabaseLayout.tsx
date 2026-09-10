import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import DatabaseRouteTabs from './DatabaseRouteTabs';

export type GetDatabaseLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

/**
 * Builds the database section layout: the shared `ProjectLayout` at the root
 * (so the project shell persists across navigation) with the database route
 * tabs as the section navigation. Thin wrapper over `getProjectLayout`.
 */
export function getDatabaseLayout(
  page: ReactElement,
  options: GetDatabaseLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <DatabaseRouteTabs />,
  });
}

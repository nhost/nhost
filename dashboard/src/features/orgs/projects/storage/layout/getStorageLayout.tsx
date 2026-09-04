import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import StorageRouteTabs from '@/features/orgs/projects/storage/layout/StorageRouteTabs';

export type GetStorageLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getStorageLayout(
  page: ReactElement,
  options: GetStorageLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <StorageRouteTabs />,
  });
}

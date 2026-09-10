import type { ReactElement } from 'react';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';

export type GetMetricsLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getMetricsLayout(
  page: ReactElement,
  options: GetMetricsLayoutOptions = {},
): ReactElement {
  return getProjectLayout(page, {
    ...options,
    navigation: <MetricsRouteTabs />,
  });
}

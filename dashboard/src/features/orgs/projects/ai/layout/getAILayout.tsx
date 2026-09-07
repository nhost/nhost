import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import {
  getProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import AIRouteTabs from '@/features/orgs/projects/ai/layout/AIRouteTabs';

export type GetAILayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

export function getAILayout(
  page: ReactElement,
  options: GetAILayoutOptions = {},
): ReactElement {
  return getProjectLayout(
    <RetryableErrorBoundary>{page}</RetryableErrorBoundary>,
    {
      ...options,
      navigation: <AIRouteTabs />,
    },
  );
}

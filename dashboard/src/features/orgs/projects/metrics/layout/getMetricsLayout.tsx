import type { ReactElement, ReactNode } from 'react';
import { ProjectSectionLayout } from '@/components/layout/ProjectSectionLayout';
import {
  ProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import MetricsRouteTabs from '@/features/orgs/projects/metrics/layout/MetricsRouteTabs';

export type GetMetricsLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

interface MetricsSectionBodyProps
  extends Pick<
    ProjectLayoutOptions,
    'sidebar' | 'navigationClassName' | 'bodyClassName' | 'contentClassName'
  > {
  page: ReactElement;
}

/**
 * Decides whether the Metrics route tabs should be shown. On a free/starter
 * org this section only ever renders the upgrade banner, so the tab bar is
 * hidden rather than shown above content that isn't actually reachable.
 */
function MetricsSectionBody({
  page,
  sidebar,
  navigationClassName,
  bodyClassName,
  contentClassName,
}: MetricsSectionBodyProps) {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const isFreeOrg = isPlatform && org?.plan?.isFree;

  return (
    <ProjectSectionLayout
      navigation={isFreeOrg ? undefined : <MetricsRouteTabs />}
      sidebar={sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={contentClassName}
    >
      {page}
    </ProjectSectionLayout>
  );
}

export function getMetricsLayout(
  page: ReactElement,
  options: GetMetricsLayoutOptions = {},
): ReactElement {
  const {
    sidebar,
    navigationClassName,
    bodyClassName,
    contentClassName,
    mainContainerProps,
    wrapper,
  } = options;

  const body: ReactNode = (
    <MetricsSectionBody
      page={page}
      sidebar={sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={contentClassName}
    />
  );

  return (
    <ProjectLayout
      mainContainerProps={
        mainContainerProps ?? {
          className: 'flex h-full flex-col overflow-hidden',
        }
      }
    >
      {wrapper ? wrapper(body) : body}
    </ProjectLayout>
  );
}

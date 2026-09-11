import type { ReactElement, ReactNode } from 'react';
import { ProjectSectionLayout } from '@/components/layout/ProjectSectionLayout';
import {
  ProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import RunRouteTabs from '@/features/orgs/projects/run/layout/RunRouteTabs';

export type GetRunLayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

interface RunSectionBodyProps
  extends Pick<
    ProjectLayoutOptions,
    'sidebar' | 'navigationClassName' | 'bodyClassName' | 'contentClassName'
  > {
  page: ReactElement;
}

/**
 * Decides whether the Run route tabs should be shown. On a free/starter org
 * this section only ever renders the upgrade banner, so the tab bar is
 * hidden rather than shown above content that isn't actually reachable.
 */
function RunSectionBody({
  page,
  sidebar,
  navigationClassName,
  bodyClassName,
  contentClassName,
}: RunSectionBodyProps) {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const isFreeOrg = isPlatform && org?.plan?.isFree;

  return (
    <ProjectSectionLayout
      navigation={isFreeOrg ? undefined : <RunRouteTabs />}
      sidebar={sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={contentClassName}
    >
      {page}
    </ProjectSectionLayout>
  );
}

export function getRunLayout(
  page: ReactElement,
  options: GetRunLayoutOptions = {},
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
    <RunSectionBody
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

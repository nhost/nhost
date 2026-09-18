import type { ReactElement, ReactNode } from 'react';
import {
  ProjectLayout,
  type ProjectLayoutOptions,
} from '@/features/orgs/layout/ProjectLayout';
import ProjectSectionContent from '@/features/orgs/layout/ProjectLayout/ProjectSectionContent';
import AIRouteTabs from '@/features/orgs/projects/ai/layout/AIRouteTabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

export type GetAILayoutOptions = Omit<ProjectLayoutOptions, 'navigation'>;

interface AISectionBodyProps
  extends Pick<
    ProjectLayoutOptions,
    'sidebar' | 'navigationClassName' | 'bodyClassName' | 'contentClassName'
  > {
  page: ReactElement;
}

/**
 * Decides whether the AI route tabs should be shown. On a free/starter org
 * this section only ever renders the upgrade banner, so the tab bar is
 * hidden rather than shown above content that isn't actually reachable.
 */
function AISectionBody({
  page,
  sidebar,
  navigationClassName,
  bodyClassName,
  contentClassName,
}: AISectionBodyProps) {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const isFreeOrg = isPlatform && org?.plan?.isFree;

  return (
    <ProjectSectionContent
      page={page}
      navigation={isFreeOrg ? undefined : <AIRouteTabs />}
      sidebar={sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={contentClassName}
    />
  );
}

export function getAILayout(
  page: ReactElement,
  options: GetAILayoutOptions = {},
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
    <AISectionBody
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

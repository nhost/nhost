import type { ReactElement, ReactNode } from 'react';
import { ProjectSectionLayout } from '@/components/layout/ProjectSectionLayout';
import { OverviewPausedState } from '@/features/orgs/projects/overview/components/OverviewPausedState';
import { useSectionPausedState } from './useSectionPausedState';

export interface ProjectSectionContentProps {
  /**
   * The section's own page content for the current route.
   */
  page: ReactElement;
  /**
   * Section navigation (route tabs), rendered unconditionally: this is what
   * lets a section's tab bar stay visible and show its own disabled state
   * while the project is paused, instead of disappearing along with the
   * content.
   */
  navigation?: ReactNode;
  /**
   * A section's own sub-sidebar (e.g. Database's table/schema browser). This
   * depends on the project actually running just like `page` does, so it's
   * hidden together with `page` on routes that need a running project.
   */
  sidebar?: ReactNode;
  navigationClassName?: string;
  bodyClassName?: string;
  contentClassName?: string;
}

/**
 * Renders a section's navigation unconditionally, but swaps its sidebar and
 * page content together for the paused-project screen on routes that need
 * the project actually running (see projectStatePages.ts). A section's own
 * Settings route is never in that list, so it always renders normally.
 */
export default function ProjectSectionContent({
  page,
  navigation,
  sidebar,
  navigationClassName,
  bodyClassName,
  contentClassName,
}: ProjectSectionContentProps) {
  const { isBlocked, state } = useSectionPausedState();

  // A page's own `contentClassName` is tuned for that page's live layout
  // (e.g. removing top padding for a sticky toolbar, or switching to a flex
  // column for an editor). None of that applies to the paused screen, so
  // forwarding it here is what caused the paused screen's top gap to vary
  // from page to page. `OverviewPausedState` owns its own spacing, so the
  // content slot just needs its default padding neutralized while blocked.
  const resolvedContentClassName = isBlocked ? 'pt-0' : contentClassName;

  return (
    <ProjectSectionLayout
      navigation={navigation}
      sidebar={isBlocked ? undefined : sidebar}
      navigationClassName={navigationClassName}
      bodyClassName={bodyClassName}
      contentClassName={resolvedContentClassName}
    >
      {isBlocked ? <OverviewPausedState state={state} /> : page}
    </ProjectSectionLayout>
  );
}

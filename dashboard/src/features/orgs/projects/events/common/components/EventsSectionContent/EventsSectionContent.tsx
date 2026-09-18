import type { ReactElement, ReactNode } from 'react';
import { useSectionPausedState } from '@/features/orgs/layout/ProjectLayout/useSectionPausedState';
import { OverviewPausedState } from '@/features/orgs/projects/overview/components/OverviewPausedState';

export interface EventsSectionContentProps {
  page: ReactElement;
  sidebar?: ReactNode;
}

/**
 * Events (event triggers, cron triggers, one-offs) has its own hand-built
 * layout with a browsing sidebar instead of a tab bar, so it can't go
 * through ProjectSectionContent. This mirrors the same rule anyway: while
 * the project is paused, the sidebar (which depends on live trigger data)
 * and the page are both replaced with the paused-project screen, in the
 * same content slot every Events page already renders into.
 */
export default function EventsSectionContent({
  page,
  sidebar,
}: EventsSectionContentProps) {
  const { isBlocked, state } = useSectionPausedState();

  return (
    <>
      {!isBlocked && sidebar}

      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {isBlocked ? <OverviewPausedState state={state} /> : page}
      </div>
    </>
  );
}

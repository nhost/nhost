import type { ReactNode } from 'react';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';

interface AreaLayoutProps {
  /** The area's route tabs, rendered above the project-state gate. */
  tabs: ReactNode;
  children: ReactNode;
}

/**
 * The frame of a project area (Database, Auth, ...): its route tabs, then the
 * page below them. The tabs sit outside the project-state gate, so a paused
 * project's area still reaches the pages that work while paused, such as
 * settings. Whatever the page hands over is rendered as-is below the tabs, in
 * a region that scrolls on its own so the tabs stay in view. The region is
 * `relative` so absolutely positioned descendants scroll with it instead of
 * stretching an ancestor.
 */
export default function AreaLayout({ tabs, children }: AreaLayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-4 md:py-3">{tabs}</div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ProjectStateGate>{children}</ProjectStateGate>
      </div>
    </div>
  );
}

import type { PropsWithChildren } from 'react';
import ProjectLayoutSidebar from '@/features/orgs/layout/ProjectLayout/ProjectLayoutSidebar';

export default function ProjectLayoutFrame({ children }: PropsWithChildren) {
  return (
    <div className="flex h-full min-w-0 flex-row overflow-hidden">
      <ProjectLayoutSidebar />
      {children}
    </div>
  );
}

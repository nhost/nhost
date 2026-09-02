import type { PropsWithChildren } from 'react';
import ProjectLayoutSidebar from '@/features/orgs/layout/ProjectLayout/ProjectLayoutSidebar';

export default function ProjectLayoutFrame({ children }: PropsWithChildren) {
  return (
    <div className="flex min-w-0 flex-row">
      <ProjectLayoutSidebar />
      {children}
    </div>
  );
}

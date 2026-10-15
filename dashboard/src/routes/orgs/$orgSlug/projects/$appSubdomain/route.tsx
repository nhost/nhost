import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';

export const Route = createFileRoute('/orgs/$orgSlug/projects/$appSubdomain')({
  component: ProjectLayout,
});

function ProjectLayout() {
  return (
    <ProjectScope>
      <Outlet />
    </ProjectScope>
  );
}

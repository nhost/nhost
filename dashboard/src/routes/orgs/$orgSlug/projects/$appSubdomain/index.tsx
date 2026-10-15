import { createFileRoute } from '@tanstack/react-router';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { ApplicationLive } from '@/features/orgs/projects/common/components/ApplicationLive';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute('/orgs/$orgSlug/projects/$appSubdomain/')({
  component: RouteComponent,
});

function AppIndexPage() {
  const { project, error } = useProject();
  if (error) {
    throw error;
  }

  if (!project) {
    return null;
  }

  return <ApplicationLive />;
}

function RouteComponent() {
  return (
    <ProjectStateGate>
      <AppIndexPage />
    </ProjectStateGate>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { SelectOrgAndProject } from '@/components/common/SelectOrgAndProject';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';

export const Route = createFileRoute('/orgs/_/projects/_/$')({
  component: RouteComponent,
});

function OrganizationAndProject() {
  return <SelectOrgAndProject />;
}

function RouteComponent() {
  return (
    <StandaloneLayout title="Select a Project">
      <AuthGuard>
        <OrganizationAndProject />
      </AuthGuard>
    </StandaloneLayout>
  );
}

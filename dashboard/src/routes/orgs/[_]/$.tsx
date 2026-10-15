import { createFileRoute } from '@tanstack/react-router';
import { SelectOrg } from '@/components/common/SelectOrg';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';

export const Route = createFileRoute('/orgs/_/$')({
  component: RouteComponent,
});

function SelectOrganization() {
  return <SelectOrg />;
}

function RouteComponent() {
  return (
    <StandaloneLayout title="Select an Organization">
      <AuthGuard>
        <SelectOrganization />
      </AuthGuard>
    </StandaloneLayout>
  );
}

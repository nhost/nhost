import { createFileRoute } from '@tanstack/react-router';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CustomTypesEditor } from '@/features/orgs/projects/graphql/actions/components/CustomTypesEditor';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/actions/custom-types',
)({
  component: CustomTypesEditorPage,
});

function CustomTypesEditorPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <CustomTypesEditor />
    </RetryableErrorBoundary>
  );
}

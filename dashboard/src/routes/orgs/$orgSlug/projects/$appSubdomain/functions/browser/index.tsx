import { createFileRoute } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/v3/spinner';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/',
)({
  component: FunctionsPage,
});

function FunctionsPage() {
  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <FunctionsEmptyState
        title="Functions"
        description="An error occurred while fetching functions."
      />
    );
  }

  if (Array.isArray(functions) && functions.length === 0) {
    return (
      <FunctionsEmptyState
        title="Functions"
        description="No functions have been deployed yet."
      />
    );
  }

  return (
    <FunctionsEmptyState
      title="Functions"
      description="Select a function from the sidebar to get started."
    />
  );
}

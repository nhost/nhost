import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ServerlessFunctionView } from '@/features/orgs/projects/serverless-functions/components/ServerlessFunctionView';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$',
)({
  component: FunctionDetailsPage,
});

function FunctionDetailsPage() {
  const router = useRouter();
  const { functionSlug } = router.query;
  const slug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : (functionSlug as string);

  return (
    <RetryableErrorBoundary>
      <ServerlessFunctionView key={slug} />
    </RetryableErrorBoundary>
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/$',
)({
  component: StoragePage,
});

function StoragePage() {
  return (
    <div className="h-full max-w-full pb-25 xs+:pb-[56.5px]">
      <RetryableErrorBoundary>
        <Bucket />
      </RetryableErrorBoundary>
    </div>
  );
}

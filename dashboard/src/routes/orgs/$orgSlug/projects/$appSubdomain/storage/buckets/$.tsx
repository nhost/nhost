import { createFileRoute } from '@tanstack/react-router';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';
import { getSearchParam } from '@/lib/search-params';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/$',
)({
  validateSearch: (search): { page?: string } => ({
    page: getSearchParam(search.page),
  }),
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

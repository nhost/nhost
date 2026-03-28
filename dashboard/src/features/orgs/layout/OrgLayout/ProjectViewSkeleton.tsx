import { useRouter } from 'next/router';
import { Skeleton } from '@/components/ui/v3/skeleton';

const baseProjectPageRoute = '/orgs/[orgSlug]/projects/[appSubdomain]/';
const sidebarPages = new Set(
  [
    'events/event-triggers',
    'events/event-triggers/[eventTriggerSlug]',
    'events/cron-triggers',
    'events/cron-triggers/[cronTriggerSlug]',
    'events/one-offs',
    'ai/auto-embeddings',
    'ai/assistants',
    'ai/file-stores',
    'storage',
    'graphql/remote-schemas',
    'graphql/remote-schemas/[remoteSchemaSlug]',
    'database',
    'database/browser/[dataSourceSlug]',
  ].map((page) => baseProjectPageRoute.concat(page)),
);

export default function ProjectViewSkeleton() {
  const { route } = useRouter();
  const hasSidebar = sidebarPages.has(route);

  return (
    <div className="flex h-full w-full">
      {hasSidebar && (
        <div className="flex w-60 shrink-0 flex-col gap-4 border-r p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-2 flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

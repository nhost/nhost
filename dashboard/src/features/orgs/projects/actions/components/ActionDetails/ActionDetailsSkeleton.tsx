import { Skeleton } from '@/components/ui/v3/skeleton';

export default function ActionDetailsSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 px-6 pt-6 pb-0">
        <div className="pb-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 shrink-0 rounded-md" />
            <div className="min-w-0">
              <Skeleton className="mb-1 h-7 w-52" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="mt-3 h-4 w-80" />
        </div>

        <div className="my-6">
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <Skeleton className="mb-3 h-5 w-44" />
          <Skeleton className="h-24 w-full" />
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <Skeleton className="mb-3 h-5 w-44" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

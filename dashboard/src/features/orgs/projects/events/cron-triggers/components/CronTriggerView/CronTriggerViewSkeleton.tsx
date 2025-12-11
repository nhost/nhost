import { Skeleton } from '@/components/ui/v3/skeleton';

export default function CronTriggerViewSkeleton() {
  return (
    <div className="w-full px-10 py-8">
      <div className="mx-auto w-full max-w-5xl rounded-lg bg-background p-4">
        <div className="mb-6">
          <Skeleton className="mb-1 h-7 w-52" />
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="mb-4 flex gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
              <Skeleton className="mb-3 h-5 w-44" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
            <Skeleton className="mb-3 h-5 w-48" />
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

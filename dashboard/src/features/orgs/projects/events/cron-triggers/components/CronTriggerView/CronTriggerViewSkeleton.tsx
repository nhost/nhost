import { Skeleton } from '@/components/ui/v3/skeleton';

export default function CronTriggerViewSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1">
        <div className="p-6">
          <Skeleton className="mb-1 h-7 w-52" />
          <Skeleton className="h-4 w-40" />
        </div>

        <div className="flex flex-col items-start justify-between gap-4 px-6 py-4 lg:flex-row lg:items-center">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-16 rounded-md" />
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
            <Skeleton className="mb-3 h-5 w-44" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
            <Skeleton className="mb-3 h-5 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <Skeleton className="mb-3 h-5 w-44" />
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-1">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>

        <div className="rounded border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

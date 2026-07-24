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
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded border p-4">
              <Skeleton className="mb-3 h-5 w-28" />
              <Skeleton className="h-9 w-full rounded" />
            </div>

            <div className="rounded border p-4">
              <Skeleton className="mb-3 h-5 w-28" />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border">
            <div className="flex items-center gap-2 p-4">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="border-t p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          </div>

          <div className="rounded border">
            <div className="flex items-center gap-2 p-4">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="border-t p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

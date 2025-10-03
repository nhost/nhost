import { Skeleton } from '@/components/ui/v3/skeleton';

export default function EventsBrowserSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex flex-row items-center justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {[0, 1].map((groupIndex) => (
          <div key={groupIndex} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-md" />
            </div>
            <div className="flex flex-col gap-1 pl-4">
              {[0, 1, 2].map((itemIndex) => (
                <Skeleton key={itemIndex} className="h-9 w-52" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

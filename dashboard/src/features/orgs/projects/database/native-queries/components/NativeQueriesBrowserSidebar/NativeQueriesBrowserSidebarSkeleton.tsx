import { Skeleton } from '@/components/ui/v3/skeleton';

export default function NativeQueriesBrowserSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col px-2">
      <Skeleton className="mb-2 h-10 w-full" />
      <Skeleton className="mb-2 h-9 w-full" />
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="mb-1 h-9 w-full" />
      ))}
    </div>
  );
}

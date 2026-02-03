import { Skeleton } from '@/components/ui/v3/skeleton';

export default function OneOffsBrowserSidebarSkeleton() {
  return (
    <div className="flex h-full flex-col px-2">
      <div className="flex flex-col gap-0">
        <div className="flex flex-row items-center justify-between">
          <Skeleton className="my-1 h-9 w-full" />
        </div>
        <div className="flex flex-col text-balance">
          {[0, 1, 2].map((index) => (
            <div key={index} className="group pb-1">
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from '@/components/ui/v3/skeleton';

export default function NativeQueryDetailsSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

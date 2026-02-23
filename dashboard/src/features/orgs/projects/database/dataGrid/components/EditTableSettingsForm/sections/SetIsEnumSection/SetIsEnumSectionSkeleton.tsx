import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';

export default function SetIsEnumSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between gap-3 px-4">
          <div className="grid grid-flow-row gap-1">
            <h2 className="font-semibold text-lg">Set Table as Enum</h2>
            <p className="text-muted-foreground text-sm+">
              Expose the table values as GraphQL enums in the GraphQL API
            </p>
          </div>
        </div>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
        </div>
        <div className="grid grid-flow-col items-center justify-end gap-x-2 border-t px-4 pt-3.5">
          <ButtonWithLoading
            variant="outline"
            type="submit"
            disabled
            className="text-sm+ text-white"
          >
            Save
          </ButtonWithLoading>
        </div>
      </div>
    </div>
  );
}

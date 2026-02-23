import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';

const COLUMN_SKELETON_KEYS = ['first', 'second', 'third', 'fourth'];

export default function ColumnsNameCustomizationSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between gap-3 px-4">
          <div className="grid grid-flow-col gap-4">
            <div className="grid grid-flow-row gap-1">
              <h2 className="font-semibold text-lg">GraphQL Field Names</h2>

              <p className="text-muted-foreground text-sm+">
                Expose each column with a different name in your GraphQL API.
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-lg">
            <div className="mx-4 grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              <span>Column</span>
              <span>Data Type</span>
              <span>GraphQL Field Name</span>
            </div>

            <div className="space-y-2 py-3">
              {COLUMN_SKELETON_KEYS.map((placeholderKey) => (
                <div
                  key={`column-skeleton-${placeholderKey}`}
                  className="grid h-14 grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-background px-4 py-3"
                >
                  <Skeleton className="h-full" />
                  <Skeleton className="h-full" />
                  <Skeleton className="h-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
          <div className="flex items-center gap-2">
            <Button variant="outline" color="secondary" type="button" disabled>
              Reset to default
            </Button>
            <Button variant="secondary" type="button" disabled>
              Make camelCase
            </Button>
          </div>
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

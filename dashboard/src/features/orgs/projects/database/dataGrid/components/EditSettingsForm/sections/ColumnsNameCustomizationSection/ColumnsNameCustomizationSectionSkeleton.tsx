import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Skeleton } from '@/components/ui/v3/skeleton';

const COLUMN_SKELETON_KEYS = ['first', 'second', 'third', 'fourth'];

export default function ColumnsNameCustomizationSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <SettingsContainer
        title="GraphQL Field Names"
        description="Expose each column with a different name in your GraphQL API."
        slotProps={{
          submitButton: {
            disabled: true,
          },
        }}
      >
        <div className="space-y-3">
          <div className="rounded-lg">
            <div className="grid grid-cols-[minmax(0,1fr),minmax(0,1fr),minmax(0,1.5fr)] items-center gap-3 rounded-md bg-muted px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
      </SettingsContainer>
    </div>
  );
}

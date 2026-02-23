import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';

export default function CustomGraphQLRootFieldsSectionSkeleton() {
  const accordionItems = ['Query and Subscription', 'Mutation'];

  return (
    <div className="flex flex-col gap-4 px-6 pb-4">
      <div className="box grid grid-flow-row gap-4 overflow-hidden rounded-lg border-1 py-4">
        <div className="grid grid-flow-col place-content-between gap-3 px-4">
          <div className="grid grid-flow-row gap-1">
            <h2 className="font-semibold text-lg">
              Custom GraphQL Root Fields
            </h2>
            <p className="text-muted-foreground text-sm+">
              Configure the root field names and optional comments exposed in
              your GraphQL API.
            </p>
          </div>
        </div>

        <div className="grid grid-flow-row gap-4 px-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-3">
            {accordionItems.map((label) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-5" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-flow-col items-center justify-between gap-x-2 border-t px-4 pt-3.5">
          <div className="flex items-center gap-2">
            <Button variant="outline" color="secondary" disabled>
              Reset to default
            </Button>
            <Button variant="secondary" disabled>
              Make camelCase
            </Button>
          </div>
          <ButtonWithLoading
            variant="outline"
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

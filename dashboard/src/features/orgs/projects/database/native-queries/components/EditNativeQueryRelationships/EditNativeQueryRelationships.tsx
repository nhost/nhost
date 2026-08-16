import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { NativeQueryRelationships } from '@/features/orgs/projects/database/native-queries/components/NativeQueryRelationships';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';

interface EditNativeQueryRelationshipsProps {
  queryName: string;
  onCancel?: VoidFunction;
}

export default function EditNativeQueryRelationships({
  queryName,
  onCancel,
}: EditNativeQueryRelationshipsProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug } = router.query;
  const {
    data: queries = [],
    isLoading: queriesLoading,
    error: queriesError,
  } = useGetNativeQueries();
  const {
    data: models = [],
    isLoading: modelsLoading,
    error: modelsError,
  } = useGetLogicalModels();

  const metadataError = queriesError ?? modelsError;
  if (metadataError) {
    throw metadataError instanceof Error
      ? metadataError
      : new Error('Could not load native query relationships.');
  }

  const isLoading = queriesLoading || modelsLoading;
  const query = queries.find((item) => item.root_field_name === queryName);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
        {isLoading ? (
          <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
            <span className="text-muted-foreground text-xs">
              Loading native query relationships...
            </span>
          </Spinner>
        ) : query ? (
          <NativeQueryRelationships
            query={query}
            queries={queries}
            models={models}
            getQueryHref={(targetQueryName) =>
              `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/queries/${targetQueryName}`
            }
          />
        ) : (
          <p className="rounded-md bg-muted p-4 text-muted-foreground text-sm">
            Native query {queryName} no longer exists.
          </p>
        )}
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 px-6 py-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  );
}

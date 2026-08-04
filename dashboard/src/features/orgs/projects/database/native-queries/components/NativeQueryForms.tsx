import { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import NativeQueryForm, {
  type NativeQueryFormValues,
} from '@/features/orgs/projects/database/native-queries/components/NativeQueryForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useGetNativeQueries from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

interface DrawerFormProps {
  onCancel?: (event?: unknown) => void;
}

export function CreateNativeQueryForm({ onCancel }: DrawerFormProps) {
  const modelsResult = useGetLogicalModels();
  const queriesResult = useGetNativeQueries();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useNativeQueryMetadataMutation({ type: 'add' });
  const initialValuesRef = useRef<NativeQueryFormValues | null>(null);

  const models = modelsResult.data ?? [];
  const queries = queriesResult.data ?? [];

  if (
    initialValuesRef.current === null &&
    (modelsResult.isLoading || queriesResult.isLoading)
  ) {
    return (
      <div
        className="space-y-4 p-6"
        role="status"
        aria-label="Loading creation form"
      >
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (
    initialValuesRef.current === null &&
    (modelsResult.error instanceof Error ||
      queriesResult.error instanceof Error)
  ) {
    return (
      <div className="space-y-4 p-6 text-foreground" role="alert">
        <p>Logical models and native queries could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => onCancel?.()}>
          Close
        </Button>
      </div>
    );
  }

  if (initialValuesRef.current === null) {
    initialValuesRef.current = {
      source: 'default',
      rootFieldName: '',
      description: '',
      returns: models[0]?.name ?? '',
      code: '',
      arguments: [],
    };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <NativeQueryForm
        resetToken="create"
        values={initialValuesRef.current}
        existingNames={queries.map((query) => query.root_field_name)}
        logicalModelNames={models.map((model) => model.name)}
        sourceOptions={sourceNames}
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
        onSubmit={async (nextValues) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                args: buildNativeQueryTrackArgs(nextValues),
              }),
            {
              loadingMessage: 'Creating native query...',
              successMessage: 'Native query created.',
              errorMessage: 'Could not create the native query.',
            },
          );
          if (result) {
            onCancel?.();
          }
        }}
      />
    </div>
  );
}

interface EditNativeQueryFormProps extends DrawerFormProps {
  query: NativeQueryItem;
}

export function EditNativeQueryForm({
  query,
  onCancel,
}: EditNativeQueryFormProps) {
  const { data: models = [] } = useGetLogicalModels();
  const { data: queries = [] } = useGetNativeQueries();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const values = useMemo(() => nativeQueryToFormValues(query), [query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <NativeQueryForm
        resetToken={query.root_field_name}
        values={values}
        existingNames={queries.map((item) => item.root_field_name)}
        originalName={query.root_field_name}
        logicalModelNames={models.map((model) => model.name)}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
        onSubmit={async (nextValues) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                original: query,
                args: buildNativeQueryTrackArgs(nextValues, query),
              }),
            {
              loadingMessage: 'Updating native query...',
              successMessage: 'Native query updated.',
              errorMessage: 'Could not update the native query.',
            },
          );
          if (result) {
            onCancel?.();
          }
        }}
      />
    </div>
  );
}

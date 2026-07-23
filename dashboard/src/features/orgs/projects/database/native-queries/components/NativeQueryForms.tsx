import { useRouter } from 'next/router';
import { useMemo } from 'react';
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
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug } = router.query;
  const { data: models = [] } = useGetLogicalModels();
  const { data: queries = [] } = useGetNativeQueries();
  const mutation = useNativeQueryMetadataMutation({ type: 'add' });
  const values = useMemo<NativeQueryFormValues>(
    () => ({
      rootFieldName: '',
      returns: models[0]?.name ?? '',
      code: '',
      arguments: [],
    }),
    [models],
  );

  return (
    <div className="p-6 text-foreground">
      <p className="mb-5 text-muted-foreground text-sm">
        Expose a SQL query as a read-only GraphQL root field.
      </p>
      <NativeQueryForm
        resetToken="create"
        values={values}
        existingNames={queries.map((query) => query.root_field_name)}
        logicalModelNames={models.map((model) => model.name)}
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
        onViewLogicalModels={() => {
          onCancel?.();
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}`,
          );
        }}
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
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug } = router.query;
  const { data: models = [] } = useGetLogicalModels();
  const { data: queries = [] } = useGetNativeQueries();
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const values = useMemo(
    () => nativeQueryToFormValues(query),
    [query],
  );

  return (
    <div className="p-6 text-foreground">
      <p className="mb-5 text-muted-foreground text-sm">
        Update the root field, SQL, return model, or arguments.
      </p>
      <NativeQueryForm
        resetToken={query.root_field_name}
        values={values}
        existingNames={queries.map((item) => item.root_field_name)}
        originalName={query.root_field_name}
        logicalModelNames={models.map((model) => model.name)}
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
        onViewLogicalModels={() => {
          onCancel?.();
          router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}`,
          );
        }}
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

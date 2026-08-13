import { useCallback } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { BaseNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { buildNativeQueryTrackArgs } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const DIRTY_SOURCE_ID = 'edit-native-query';

export interface EditNativeQueryFormProps extends DialogFormProps {
  query: NativeQueryItem;
  onCancel?: (event?: unknown) => void;
}

export default function EditNativeQueryForm({
  query,
  onCancel,
  location,
}: EditNativeQueryFormProps) {
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels();
  const { data: queries = [] } = useGetNativeQueries();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const reportDirtyState = useCallback(
    (isDirty: boolean) => setDirtySource(DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseNativeQueryForm
        key={query.root_field_name}
        values={nativeQueryToFormValues(query)}
        existingNames={queries.map((item) => item.root_field_name)}
        originalName={query.root_field_name}
        logicalModelNames={models.map((model) => model.name)}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={mutation.isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
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

import { useCallback } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { buildLogicalModelTrackArgs } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import { logicalModelFieldsToForm } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const DIRTY_SOURCE_ID = 'edit-logical-model';

export interface EditLogicalModelFormProps extends DialogFormProps {
  model: LogicalModelItem;
  onCancel?: (event?: unknown) => void;
}

export default function EditLogicalModelForm({
  model,
  onCancel,
  location,
}: EditLogicalModelFormProps) {
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useLogicalModelMetadataMutation({ type: 'edit' });
  const modelNames = models.map((item) => item.name);
  const reportDirtyState = useCallback(
    (isDirty: boolean) => setDirtySource(DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseLogicalModelForm
        key={model.name}
        layout="drawer"
        values={{
          source: 'default',
          name: model.name,
          description: model.description ?? '',
          fields: logicalModelFieldsToForm(model.fields),
        }}
        existingNames={modelNames}
        originalName={model.name}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={mutation.isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (nextValues) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                original: model,
                args: buildLogicalModelTrackArgs(nextValues),
              }),
            {
              loadingMessage: 'Updating logical model...',
              successMessage: 'Logical model updated.',
              errorMessage: 'Could not update the logical model.',
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

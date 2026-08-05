import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import LogicalModelForm from '@/features/orgs/projects/database/native-queries/components/LogicalModelForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useLogicalModelMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import buildLogicalModelTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import {
  createEmptyTypeNode,
  logicalModelFieldsToForm,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const CREATE_DIRTY_SOURCE_ID = 'create-logical-model';
const EDIT_DIRTY_SOURCE_ID = 'edit-logical-model';

interface DrawerFormProps extends DialogFormProps {
  onCancel?: (event?: unknown) => void;
}

interface CreateLogicalModelFormProps extends DrawerFormProps {
  logicalModelNames?: string[];
  lockedSource?: string;
  onCreated?: (name: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function CreateLogicalModelForm({
  onCancel,
  logicalModelNames,
  lockedSource,
  onCreated,
  onDirtyChange,
  location,
}: CreateLogicalModelFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useLogicalModelMetadataMutation({ type: 'add' });
  const modelNames = logicalModelNames ?? models.map((model) => model.name);
  const isEmbedded = onCreated !== undefined;
  const reportDirtyState = useCallback(
    (isDirty: boolean) => {
      if (isEmbedded) {
        onDirtyChange?.(isDirty);
        return;
      }

      setDirtySource(CREATE_DIRTY_SOURCE_ID, isDirty, location);
    },
    [isEmbedded, location, onDirtyChange, setDirtySource],
  );
  const initialValues = useMemo<LogicalModelFormValues | undefined>(
    () =>
      lockedSource === undefined
        ? undefined
        : {
            source: lockedSource,
            name: '',
            description: '',
            fields: [
              { name: '', type: createEmptyTypeNode(), description: '' },
            ],
          },
    [lockedSource],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <LogicalModelForm
        resetToken="create"
        layout={isEmbedded ? 'embedded' : 'drawer'}
        values={initialValues}
        existingNames={modelNames}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled={lockedSource !== undefined}
        isPending={mutation.isPending}
        cancelLabel="Cancel"
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (values) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                args: buildLogicalModelTrackArgs(values),
              }),
            {
              loadingMessage: 'Creating logical model...',
              successMessage: 'Logical model created.',
              errorMessage: 'Could not create the logical model.',
            },
          );
          if (!result) {
            return;
          }

          if (onCreated) {
            onCreated(values.name);
            return;
          }

          reportDirtyState(false);
          const { orgSlug, appSubdomain } = router.query;
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${values.source}/models/${values.name}`,
          );
          onCancel?.();
        }}
      />
    </div>
  );
}

interface EditLogicalModelFormProps extends DrawerFormProps {
  model: LogicalModelItem;
}

export function EditLogicalModelForm({
  model,
  onCancel,
  location,
}: EditLogicalModelFormProps) {
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useLogicalModelMetadataMutation({ type: 'edit' });
  const values = useMemo<LogicalModelFormValues>(
    () => ({
      source: 'default',
      name: model.name,
      description: model.description ?? '',
      fields: logicalModelFieldsToForm(model.fields),
    }),
    [model],
  );
  const modelNames = models.map((item) => item.name);
  const reportDirtyState = useCallback(
    (isDirty: boolean) =>
      setDirtySource(EDIT_DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <LogicalModelForm
        resetToken={model.name}
        layout="drawer"
        values={values}
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

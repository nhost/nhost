import { useRouter } from 'next/router';
import { useMemo } from 'react';
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
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

interface DrawerFormProps {
  onCancel?: (event?: unknown) => void;
}

interface CreateLogicalModelFormProps extends DrawerFormProps {
  logicalModelNames?: string[];
  lockedSource?: string;
  onCreated?: (name: string) => void;
}

export function CreateLogicalModelForm({
  onCancel,
  logicalModelNames,
  lockedSource,
  onCreated,
}: CreateLogicalModelFormProps) {
  const router = useRouter();
  const { data: models = [] } = useGetLogicalModels();
  const { data: sourceNames = [] } = useGetDataSources();
  const mutation = useLogicalModelMetadataMutation({ type: 'add' });
  const modelNames = logicalModelNames ?? models.map((model) => model.name);
  const isEmbedded = onCreated !== undefined;
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
    <div
      className={
        isEmbedded
          ? 'flex min-h-0 flex-1 flex-col text-foreground'
          : 'flex min-h-0 flex-1 flex-col p-6 text-foreground'
      }
    >
      <LogicalModelForm
        resetToken="create"
        values={initialValues}
        existingNames={modelNames}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled={lockedSource !== undefined}
        isPending={mutation.isPending}
        cancelLabel="Cancel"
        onCancel={() => onCancel?.()}
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

          const { orgSlug, appSubdomain } = router.query;
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${values.source}/models/${values.name}`,
          );
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
}: EditLogicalModelFormProps) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6 text-foreground">
      <LogicalModelForm
        resetToken={model.name}
        values={values}
        existingNames={modelNames}
        originalName={model.name}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
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

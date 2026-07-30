import { useMemo } from 'react';
import LogicalModelForm, {
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelForm';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useLogicalModelMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  formFieldsToLogicalModelFields,
  logicalModelFieldsToForm,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

interface DrawerFormProps {
  onCancel?: (event?: unknown) => void;
}

interface CreateLogicalModelFormProps extends DrawerFormProps {
  logicalModelNames?: string[];
  onCreated?: (name: string) => void;
}

export function CreateLogicalModelForm({
  onCancel,
  logicalModelNames,
  onCreated,
}: CreateLogicalModelFormProps) {
  const { data: models = [] } = useGetLogicalModels();
  const mutation = useLogicalModelMetadataMutation({ type: 'add' });
  const modelNames = logicalModelNames ?? models.map((model) => model.name);
  const isEmbedded = onCreated !== undefined;

  return (
    <div className={isEmbedded ? 'text-foreground' : 'p-6 text-foreground'}>
      <p className="mb-5 text-muted-foreground text-sm">
        Define the fields and recursive return types for this model.
      </p>
      <LogicalModelForm
        resetToken="create"
        existingNames={modelNames}
        logicalModelNames={modelNames}
        isPending={mutation.isPending}
        cancelLabel={isEmbedded ? 'Back' : 'Cancel'}
        nameInputAutoFocus={isEmbedded}
        onCancel={() => onCancel?.()}
        onSubmit={async (values) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                args: {
                  source: 'default',
                  name: values.name,
                  fields: formFieldsToLogicalModelFields(values.fields),
                },
              }),
            {
              loadingMessage: 'Creating logical model...',
              successMessage: 'Logical model created.',
              errorMessage: 'Could not create the logical model.',
            },
          );
          if (result) {
            if (onCreated) {
              onCreated(values.name);
            } else {
              onCancel?.();
            }
          }
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
  const mutation = useLogicalModelMetadataMutation({ type: 'edit' });
  const values = useMemo<LogicalModelFormValues>(
    () => ({
      name: model.name,
      fields: logicalModelFieldsToForm(model.fields),
    }),
    [model],
  );
  const modelNames = models.map((item) => item.name);

  return (
    <div className="p-6 text-foreground">
      <p className="mb-5 text-muted-foreground text-sm">
        Update the model definition. Existing select permissions are preserved.
      </p>
      <LogicalModelForm
        resetToken={model.name}
        values={values}
        existingNames={modelNames}
        originalName={model.name}
        logicalModelNames={modelNames}
        isPending={mutation.isPending}
        onCancel={() => onCancel?.()}
        onSubmit={async (nextValues) => {
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                original: model,
                args: {
                  source: 'default',
                  name: nextValues.name,
                  fields: formFieldsToLogicalModelFields(nextValues.fields),
                },
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

import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  buildLogicalModelDTO,
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import logicalModelFieldsToForm from '@/features/orgs/projects/database/native-queries/utils/logicalModelFieldsToForm';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

const DIRTY_SOURCE_ID = 'edit-logical-model';

export interface EditLogicalModelFormProps extends DialogFormProps {
  model: LogicalModelItem;
  source?: string;
  onCancel?: (event?: unknown) => void;
}

export default function EditLogicalModelForm({
  model,
  source = 'default',
  onCancel,
  location,
}: EditLogicalModelFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels(source);
  const { data: sourceNames = [] } = useGetDataSources();
  const { mutateAsync: updateLogicalModel, isPending } =
    useLogicalModelMetadataMutation({ type: 'edit' });
  const modelNames = models.map((item) => item.name);

  const reportDirtyState = useCallback(
    (isDirty: boolean) => setDirtySource(DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

  async function handleSubmit(nextValues: LogicalModelFormValues) {
    const submissionPath = router.asPath;
    const result = await execPromiseWithErrorToast(
      () =>
        updateLogicalModel({
          ...buildLogicalModelDTO(nextValues),
          original: model,
        }),
      {
        loadingMessage: 'Updating logical model...',
        successMessage: 'Logical model updated.',
        errorMessage: 'Could not update the logical model.',
      },
    );
    if (!result || router.asPath !== submissionPath) {
      return;
    }

    reportDirtyState(false);
    const { orgSlug, appSubdomain, modelSlug } = router.query;
    if (modelSlug === model.name && nextValues.name !== model.name) {
      await router.push(
        `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(nextValues.source)}/models/${encodeURIComponent(nextValues.name)}`,
      );
    }
    onCancel?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseLogicalModelForm
        key={model.name}
        isDrawer
        values={{
          source,
          name: model.name,
          description: model.description ?? '',
          fields: logicalModelFieldsToForm(model.fields),
        }}
        existingNames={modelNames}
        originalName={model.name}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

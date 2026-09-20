import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  buildLogicalModelDTO,
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

const DIRTY_SOURCE_ID = 'create-logical-model';

export interface CreateLogicalModelFormProps extends DialogFormProps {
  onSubmit?: () => void;
  onCancel?: (event?: unknown) => void;
  onCreated?: (name: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function CreateLogicalModelForm({
  onSubmit,
  onCancel,
  onCreated,
  onDirtyChange,
  location,
}: CreateLogicalModelFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels();
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: createLogicalModel, isPending } =
    useLogicalModelMetadataMutation({ type: 'add' });
  const isEmbedded = onCreated !== undefined;

  const reportDirtyState = useCallback(
    (isDirty: boolean) => {
      if (isEmbedded) {
        onDirtyChange?.(isDirty);
        return;
      }

      setDirtySource(DIRTY_SOURCE_ID, isDirty, location);
    },
    [isEmbedded, location, onDirtyChange, setDirtySource],
  );

  async function handleSubmit(values: LogicalModelFormValues) {
    const result = await execPromiseWithErrorToast(
      () =>
        createLogicalModel({
          ...buildLogicalModelDTO(values),
          resourceVersion: resourceVersion!,
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
      `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/default/models/${encodeURIComponent(values.name)}`,
    );
    onSubmit?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseLogicalModelForm
        isDrawer={!isEmbedded}
        logicalModelNames={models.map((model) => model.name)}
        isPending={isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

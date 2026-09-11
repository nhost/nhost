import { useRouter } from 'next/router';
import { useCallback, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  buildLogicalModelDTO,
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import createEmptyTypeNode from '@/features/orgs/projects/database/native-queries/utils/createEmptyTypeNode';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

const DIRTY_SOURCE_ID = 'create-logical-model';

export interface CreateLogicalModelFormProps extends DialogFormProps {
  logicalModelNames?: string[];
  initialSource?: string;
  lockedSource?: string;
  onCancel?: (event?: unknown) => void;
  onCreated?: (name: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

function initialValues(
  lockedSource?: string,
): LogicalModelFormValues | undefined {
  if (lockedSource === undefined) {
    return undefined;
  }

  return {
    source: lockedSource,
    name: '',
    description: '',
    fields: [{ name: '', type: createEmptyTypeNode(), description: '' }],
  };
}

export default function CreateLogicalModelForm({
  onCancel,
  logicalModelNames,
  initialSource = 'default',
  lockedSource,
  onCreated,
  onDirtyChange,
  location,
}: CreateLogicalModelFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const [selectedSource, setSelectedSource] = useState(
    lockedSource ?? initialSource,
  );
  const { data: models = [] } = useGetLogicalModels(selectedSource);
  const { data: sourceNames = [] } = useGetDataSources();
  const { mutateAsync: createLogicalModel, isPending } =
    useLogicalModelMetadataMutation({ type: 'add' });
  const modelNames = logicalModelNames ?? models.map((model) => model.name);
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
    const submissionPath = router.asPath;
    const result = await execPromiseWithErrorToast(
      () => createLogicalModel(buildLogicalModelDTO(values)),
      {
        loadingMessage: 'Creating logical model...',
        successMessage: 'Logical model created.',
        errorMessage: 'Could not create the logical model.',
      },
    );
    if (!result || router.asPath !== submissionPath) {
      return;
    }

    if (onCreated) {
      onCreated(values.name);
      return;
    }

    reportDirtyState(false);
    const { orgSlug, appSubdomain } = router.query;
    await router.push(
      `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(values.source)}/models/${encodeURIComponent(values.name)}`,
    );
    onCancel?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseLogicalModelForm
        isDrawer={!isEmbedded}
        values={initialValues(lockedSource ?? initialSource)}
        existingNames={modelNames}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled={lockedSource !== undefined}
        isPending={isPending}
        onSourceChange={setSelectedSource}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

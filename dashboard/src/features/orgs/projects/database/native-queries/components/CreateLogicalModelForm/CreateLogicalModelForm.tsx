import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  buildLogicalModelTrackArgs,
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

const DIRTY_SOURCE_ID = 'create-logical-model';

export interface CreateLogicalModelFormProps extends DialogFormProps {
  logicalModelNames?: string[];
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

      setDirtySource(DIRTY_SOURCE_ID, isDirty, location);
    },
    [isEmbedded, location, onDirtyChange, setDirtySource],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseLogicalModelForm
        layout={isEmbedded ? 'embedded' : 'drawer'}
        values={initialValues(lockedSource)}
        existingNames={modelNames}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled={lockedSource !== undefined}
        isPending={mutation.isPending}
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

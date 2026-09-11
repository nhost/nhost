import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import {
  buildLogicalModelDTO,
  type LogicalModelFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
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
  const { data: sourceNames = [] } = useGetSupportedNativeQuerySources();
  const mutation = useLogicalModelMetadataMutation({ type: 'add' });
  const isMountedRef = useRef(true);
  const modelNames = logicalModelNames ?? models.map((model) => model.name);
  const isEmbedded = onCreated !== undefined;
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
        isDrawer={!isEmbedded}
        values={initialValues(lockedSource ?? initialSource)}
        existingNames={modelNames}
        logicalModelNames={modelNames}
        sourceOptions={sourceNames}
        sourceDisabled={lockedSource !== undefined}
        isPending={mutation.isPending}
        onSourceChange={setSelectedSource}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (values, { isCurrentDraft }) => {
          const submissionPath = router.asPath;
          const result = await execPromiseWithErrorToast(
            () => mutation.mutateAsync(buildLogicalModelDTO(values)),
            {
              loadingMessage: 'Creating logical model...',
              successMessage: 'Logical model created.',
              errorMessage: 'Could not create the logical model.',
            },
          );
          if (
            !result ||
            !isMountedRef.current ||
            router.asPath !== submissionPath ||
            !isCurrentDraft()
          ) {
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
        }}
      />
    </div>
  );
}

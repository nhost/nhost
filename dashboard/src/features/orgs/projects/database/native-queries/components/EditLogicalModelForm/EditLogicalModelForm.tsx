import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { BaseLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { buildLogicalModelDTO } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { logicalModelFieldsToForm } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
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
  const { data: sourceNames = [] } = useGetSupportedNativeQuerySources();
  const mutation = useLogicalModelMetadataMutation({ type: 'edit' });
  const isMountedRef = useRef(true);
  const modelIdentity = JSON.stringify([source, model]);
  const activeModelIdentityRef = useRef(modelIdentity);
  activeModelIdentityRef.current = modelIdentity;
  const modelNames = models.map((item) => item.name);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reportDirtyState = useCallback(
    (isDirty: boolean) => setDirtySource(DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

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
        isPending={mutation.isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (nextValues, { isCurrentDraft }) => {
          const submissionPath = router.asPath;
          const submissionModelIdentity = modelIdentity;
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                ...buildLogicalModelDTO(nextValues),
                original: model,
              }),
            {
              loadingMessage: 'Updating logical model...',
              successMessage: 'Logical model updated.',
              errorMessage: 'Could not update the logical model.',
            },
          );
          if (
            !result ||
            !isMountedRef.current ||
            router.asPath !== submissionPath ||
            !isCurrentDraft() ||
            activeModelIdentityRef.current !== submissionModelIdentity
          ) {
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
        }}
      />
    </div>
  );
}

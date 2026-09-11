import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { BaseNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import { buildNativeQueryDTO } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryToFormValues';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

const DIRTY_SOURCE_ID = 'edit-native-query';

export interface EditNativeQueryFormProps extends DialogFormProps {
  query: NativeQueryItem;
  source?: string;
  onCancel?: (event?: unknown) => void;
}

export default function EditNativeQueryForm({
  query,
  source = 'default',
  onCancel,
  location,
}: EditNativeQueryFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const { data: models = [] } = useGetLogicalModels(source);
  const { data: queries = [] } = useGetNativeQueries(source);
  const { data: sourceNames = [] } = useGetSupportedNativeQuerySources();
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const isMountedRef = useRef(true);
  const queryIdentity = JSON.stringify([source, query]);
  const activeQueryIdentityRef = useRef(queryIdentity);
  activeQueryIdentityRef.current = queryIdentity;
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
      <BaseNativeQueryForm
        key={query.root_field_name}
        values={nativeQueryToFormValues(query, source)}
        existingNames={queries.map((item) => item.root_field_name)}
        originalName={query.root_field_name}
        logicalModelNames={models.map((model) => model.name)}
        sourceOptions={sourceNames}
        sourceDisabled
        isPending={mutation.isPending}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (nextValues, { isCurrentDraft }) => {
          const submissionPath = router.asPath;
          const submissionQueryIdentity = queryIdentity;
          const result = await execPromiseWithErrorToast(
            () =>
              mutation.mutateAsync({
                ...buildNativeQueryDTO(nextValues, query),
                original: query,
              }),
            {
              loadingMessage: 'Updating native query...',
              successMessage: 'Native query updated.',
              errorMessage: 'Could not update the native query.',
            },
          );
          if (
            !result ||
            !isMountedRef.current ||
            router.asPath !== submissionPath ||
            !isCurrentDraft() ||
            activeQueryIdentityRef.current !== submissionQueryIdentity
          ) {
            return;
          }

          reportDirtyState(false);
          const { orgSlug, appSubdomain, querySlug } = router.query;
          if (
            querySlug === query.root_field_name &&
            nextValues.rootFieldName !== query.root_field_name
          ) {
            await router.push(
              `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(nextValues.source)}/queries/${encodeURIComponent(nextValues.rootFieldName)}`,
            );
          }
          onCancel?.();
        }}
      />
    </div>
  );
}

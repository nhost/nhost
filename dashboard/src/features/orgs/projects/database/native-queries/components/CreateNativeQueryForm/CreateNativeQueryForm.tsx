import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { BaseNativeQueryForm } from '@/features/orgs/projects/database/native-queries/components/BaseNativeQueryForm';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useGetSupportedNativeQuerySources } from '@/features/orgs/projects/database/native-queries/hooks/useGetSupportedNativeQuerySources';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import {
  buildNativeQueryDTO,
  type NativeQueryFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

const DIRTY_SOURCE_ID = 'create-native-query';

export interface CreateNativeQueryFormProps extends DialogFormProps {
  initialSource?: string;
  onCancel?: (event?: unknown) => void;
}

export default function CreateNativeQueryForm({
  initialSource = 'default',
  onCancel,
  location,
}: CreateNativeQueryFormProps) {
  const router = useRouter();
  const { setDirtySource } = useDialog();
  const [selectedSource, setSelectedSource] = useState(initialSource);
  const modelsResult = useGetLogicalModels(selectedSource);
  const queriesResult = useGetNativeQueries(selectedSource);
  const { data: sourceNames = [] } = useGetSupportedNativeQuerySources();
  const mutation = useNativeQueryMetadataMutation({ type: 'add' });
  const initialValuesRef = useRef<NativeQueryFormValues | null>(null);
  const isMountedRef = useRef(true);
  const reportDirtyState = useCallback(
    (isDirty: boolean) => setDirtySource(DIRTY_SOURCE_ID, isDirty, location),
    [location, setDirtySource],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const models = modelsResult.data ?? [];
  const queries = queriesResult.data ?? [];

  if (
    initialValuesRef.current === null &&
    (modelsResult.isLoading || queriesResult.isLoading)
  ) {
    return (
      <div
        className="space-y-4 p-6"
        role="status"
        aria-label="Loading creation form"
      >
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (
    initialValuesRef.current === null &&
    (modelsResult.error instanceof Error ||
      queriesResult.error instanceof Error)
  ) {
    return (
      <div className="space-y-4 p-6 text-foreground" role="alert">
        <p>Logical models and native queries could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => onCancel?.()}>
          Close
        </Button>
      </div>
    );
  }

  if (initialValuesRef.current === null) {
    initialValuesRef.current = {
      source: initialSource,
      rootFieldName: '',
      description: '',
      returns: models[0]?.name ?? '',
      code: '',
      arguments: [],
    };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col text-foreground">
      <BaseNativeQueryForm
        values={initialValuesRef.current}
        existingNames={queries.map((query) => query.root_field_name)}
        logicalModelNames={models.map((model) => model.name)}
        sourceOptions={sourceNames}
        isPending={mutation.isPending}
        onSourceChange={setSelectedSource}
        onCancel={(event) => onCancel?.(event)}
        onDirtyChange={reportDirtyState}
        onSubmit={async (nextValues, { isCurrentDraft }) => {
          const submissionPath = router.asPath;
          const result = await execPromiseWithErrorToast(
            () => mutation.mutateAsync(buildNativeQueryDTO(nextValues)),
            {
              loadingMessage: 'Creating native query...',
              successMessage: 'Native query created.',
              errorMessage: 'Could not create the native query.',
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

          reportDirtyState(false);
          const { orgSlug, appSubdomain } = router.query;
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(nextValues.source)}/queries/${encodeURIComponent(nextValues.rootFieldName)}`,
          );
          onCancel?.();
        }}
      />
    </div>
  );
}

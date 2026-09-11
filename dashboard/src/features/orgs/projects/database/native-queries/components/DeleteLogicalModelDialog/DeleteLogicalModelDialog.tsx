import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { DeleteMetadataObjectDialog } from '@/features/orgs/projects/database/native-queries/components/DeleteMetadataObjectDialog';
import { useGetLogicalModels } from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useLogicalModelMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useLogicalModelMetadataMutation';
import { getLogicalModelDependents } from '@/features/orgs/projects/database/native-queries/utils/getLogicalModelDependents';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { LogicalModelItem } from '@/utils/hasura-api/generated/schemas';

interface DeleteLogicalModelDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  model: LogicalModelItem | null;
}

export default function DeleteLogicalModelDialog({
  open,
  setOpen,
  model,
}: DeleteLogicalModelDialogProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain, dataSourceSlug, modelSlug } = router.query;
  const source =
    typeof dataSourceSlug === 'string' ? dataSourceSlug : 'default';
  const { mutateAsync: deleteLogicalModel, isPending: isDeletingLogicalModel } =
    useLogicalModelMetadataMutation({ type: 'delete' });
  const isMountedRef = useRef(true);
  const { data: logicalModels } = useGetLogicalModels(source);
  const { data: nativeQueries } = useGetNativeQueries(source);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const dependents = useMemo(
    () =>
      getLogicalModelDependents({
        name: model?.name ?? '',
        logicalModels: logicalModels ?? [],
        nativeQueries: nativeQueries ?? [],
      }),
    [model?.name, logicalModels, nativeQueries],
  );
  const dependentsCount =
    dependents.nativeQueries.length + dependents.logicalModels.length;

  const handleConfirm = async (): Promise<boolean> => {
    if (!model) {
      return false;
    }
    const submissionPath = router.asPath;
    const result = await execPromiseWithErrorToast(
      async () => {
        await deleteLogicalModel({ source, original: model });
        if (!isMountedRef.current || router.asPath !== submissionPath) {
          return false;
        }
        if (modelSlug === model.name) {
          await router.push(
            `/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${encodeURIComponent(source)}`,
          );
        }
        return true;
      },
      {
        loadingMessage: 'Deleting logical model...',
        successMessage: 'Logical model deleted successfully.',
        errorMessage: 'An error occurred while deleting the logical model.',
      },
    );
    return result === true;
  };

  return (
    <DeleteMetadataObjectDialog
      open={open}
      setOpen={setOpen}
      title="Delete Logical Model"
      noun="logical model"
      name={model?.name}
      isPending={isDeletingLogicalModel}
      onConfirm={handleConfirm}
      warning={
        dependentsCount > 0 ? (
          <Alert variant="warning">
            <AlertDescription className="space-y-2 text-left">
              <p>
                In the currently loaded metadata, other objects still reference
                this logical model, so Hasura may reject the deletion until they
                are updated:
              </p>
              {dependents.nativeQueries.length > 0 && (
                <p>
                  <strong>Native queries:</strong>{' '}
                  {dependents.nativeQueries.join(', ')}
                </p>
              )}
              {dependents.logicalModels.length > 0 && (
                <p>
                  <strong>Logical models:</strong>{' '}
                  {dependents.logicalModels
                    .map(
                      (dependent) =>
                        `${dependent.name} (${dependent.fields.join(', ')})`,
                    )
                    .join(', ')}
                </p>
              )}
            </AlertDescription>
          </Alert>
        ) : null
      }
    />
  );
}

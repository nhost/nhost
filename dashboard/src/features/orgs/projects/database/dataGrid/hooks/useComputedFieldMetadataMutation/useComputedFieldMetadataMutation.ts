import type { MutationOptions } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  AddComputedFieldArgs,
  DropComputedFieldArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperation200 } from '@/utils/hasura-api/generated/schemas/metadataOperation200';
import type { SuccessResponse } from '@/utils/hasura-api/generated/schemas/successResponse';
import createComputedField from './createComputedField';
import createComputedFieldMigration from './createComputedFieldMigration';
import deleteComputedField from './deleteComputedField';
import deleteComputedFieldMigration from './deleteComputedFieldMigration';
import editComputedField from './editComputedField';
import editComputedFieldMigration from './editComputedFieldMigration';
import type {
  ComputedFieldMutationType,
  ComputedFieldMutationVariables,
} from './types';

export type ComputedFieldMutationResponse =
  | SuccessResponse
  | MetadataOperation200;

export interface UseComputedFieldMetadataMutationOptions<
  T extends ComputedFieldMutationType,
> {
  type: T;
  mutationOptions?: MutationOptions<
    ComputedFieldMutationResponse,
    unknown,
    ComputedFieldMutationVariables<T>
  >;
}

/**
 * Manages a computed field via Hasura's metadata API (platform mode) or the
 * migrations API (local mode), depending on the environment. The `type`
 * parameter selects the operation:
 *
 * - `add`    — creates a new computed field.
 * - `edit`   — drops the field by its original name and re-adds it with the
 *              new definition, so the name itself can change. The migration
 *              variant records a rollback that restores the original
 *              definition.
 * - `delete` — drops the computed field. The migration variant records a
 *              rollback that re-adds the field with its full original
 *              definition.
 */
export default function useComputedFieldMetadataMutation<
  T extends ComputedFieldMutationType,
>({ type, mutationOptions }: UseComputedFieldMetadataMutationOptions<T>) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const { refetch: refetchResourceVersion } = useGetMetadataResourceVersion();
  const queryClient = useQueryClient();

  return useMutation<
    ComputedFieldMutationResponse,
    unknown,
    ComputedFieldMutationVariables<T>
  >(
    async (variables) => {
      const base = {
        appUrl: generateAppServiceUrl(
          project!.subdomain,
          project!.region,
          'hasura',
        ),
        adminSecret: project!.config!.hasura.adminSecret,
      } as const;

      if (isPlatform) {
        const { data: latestResourceVersion } = await refetchResourceVersion();
        const resourceVersion = latestResourceVersion!;

        switch (type) {
          case 'add':
            return createComputedField({
              ...base,
              resourceVersion,
              args: variables.args as AddComputedFieldArgs,
            });
          case 'edit': {
            const editVariables =
              variables as ComputedFieldMutationVariables<'edit'>;
            return editComputedField({
              ...base,
              resourceVersion,
              args: editVariables.args,
              original: editVariables.original,
            });
          }
          case 'delete':
            return deleteComputedField({
              ...base,
              resourceVersion,
              args: variables.args as DropComputedFieldArgs,
            });
          default:
            throw new Error(`Unsupported mutation type: ${type as string}`);
        }
      }

      switch (type) {
        case 'add':
          return createComputedFieldMigration({
            ...base,
            args: variables.args as AddComputedFieldArgs,
          });
        case 'edit': {
          const editVariables =
            variables as ComputedFieldMutationVariables<'edit'>;
          return editComputedFieldMigration({
            ...base,
            args: editVariables.args,
            original: editVariables.original,
          });
        }
        case 'delete': {
          const deleteVariables =
            variables as ComputedFieldMutationVariables<'delete'>;
          return deleteComputedFieldMigration({
            ...base,
            args: deleteVariables.args,
            original: deleteVariables.original,
          });
        }
        default:
          throw new Error(`Unsupported mutation type: ${type as string}`);
      }
    },
    {
      ...mutationOptions,
      onSuccess: (...args) => {
        queryClient.invalidateQueries({
          queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
        });
        mutationOptions?.onSuccess?.(...args);
      },
    },
  );
}

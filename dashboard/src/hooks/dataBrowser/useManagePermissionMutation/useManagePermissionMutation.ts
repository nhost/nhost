import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import type { MutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import type { ManagePermissionOptions } from './managePermission';
import managePermission from './managePermission';
import type { ManagePermissionMigrationVariables } from './managePermissionMigration';
import managePermissionMigration from './managePermissionMigration';

export interface UseManagePermissionMutationOptions
  extends Partial<ManagePermissionOptions> {
  /**
   * Props passed to the underlying mutation hook.
   */
  mutationOptions?: MutationOptions<
    void,
    unknown,
    ManagePermissionMigrationVariables
  >;
}

/**
 * This hook is a wrapper around a fetch call that manages a permission for a
 * specific role on a specific table.
 *
 * @param options - Options to use for the mutation.
 * @returns The result of the mutation.
 */
export default function useManagePermissionMutation({
  dataSource: customDataSource,
  schema: customSchema,
  table: customTable,
  appUrl: customAppUrl,
  adminSecret: customAdminSecret,
  mutationOptions,
}: UseManagePermissionMutationOptions = {}) {
  const isPlatform = useIsPlatform();
  const {
    query: { dataSourceSlug, schemaSlug },
  } = useRouter();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const appUrl = generateAppServiceUrl(
    currentApplication?.subdomain,
    currentApplication?.region.awsName,
    'hasura',
  );

  const mutationFn = isPlatform ? managePermission : managePermissionMigration;

  const mutation = useMutation(
    (variables) =>
      mutationFn({
        ...variables,
        appUrl: customAppUrl || appUrl,
        adminSecret:
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : customAdminSecret || currentApplication?.hasuraGraphqlAdminSecret,
        dataSource: customDataSource || (dataSourceSlug as string),
        schema: customSchema || (schemaSlug as string),
        table: customTable || (dataSourceSlug as string),
      }),
    mutationOptions,
  );

  return mutation;
}

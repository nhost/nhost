import NavLink from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { PermissionsLegend } from '@/features/orgs/projects/common/components/PermissionsLegend';
import {
  type RolePermissionRow,
  RolePermissionsGrid,
} from '@/features/orgs/projects/common/components/RolePermissionsGrid';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { FunctionPermissionsDescription } from '@/features/orgs/projects/database/dataGrid/components/EditFunctionPermissionsForm/FunctionPermissionsDescription';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionPermissionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPermissionQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useManageFunctionPermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManageFunctionPermissionMutation';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { getFunctionPermissionState } from '@/features/orgs/projects/database/dataGrid/utils/getFunctionPermissionState';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';

export interface EditFunctionPermissionsFormProps {
  /**
   * Determines whether the form is disabled or not.
   */
  disabled?: boolean;
  /**
   * The schema that the function is in.
   */
  schema: string;
  /**
   * The function name.
   */
  functionName: string;
  /**
   * Function OID used to fetch the function definition.
   */
  functionOID?: string;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditFunctionPermissionsForm({
  disabled,
  schema,
  functionName,
  functionOID,
  onCancel,
}: EditFunctionPermissionsFormProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;
  const dataSource = (dataSourceSlug as string) || 'default';

  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data: hasuraSettingsData, loading: hasuraSettingsLoading } =
    useGetHasuraSettingsQuery({
      variables: { appId: project?.id },
      ...(!isPlatform ? { client: localMimirClient } : {}),
      skip: !project?.id,
    });

  const inferFunctionPermissions = Boolean(
    hasuraSettingsData?.config?.hasura.settings?.inferFunctionPermissions,
  );

  const { data: functionConfig, isLoading: isLoadingFunctionConfig } =
    useFunctionCustomizationQuery({
      function: {
        name: functionName,
        schema,
      },
      dataSource,
    });

  const { data: functionData, isLoading: isLoadingFunctionData } =
    useFunctionQuery(
      [`function-definition`, `${dataSource}.${schema}.${functionName}`],
      {
        dataSource,
        functionOID,
      },
    );

  const {
    data: permissions = [],
    status: permissionStatus,
    error: permissionError,
  } = useFunctionPermissionQuery({
    schema,
    functionName,
    dataSource,
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`${dataSource}.metadata`]);

  const { org } = useCurrentOrg();
  const { closeDrawerWithDirtyGuard } = useDialog();

  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const { mutateAsync: manageFunctionPermission, isPending: isMutating } =
    useManageFunctionPermissionMutation();

  const configuration = functionConfig?.configuration;

  const exposedAs = configuration?.exposed_as;
  const isMutationFunction =
    exposedAs === 'mutation' ||
    (exposedAs == null &&
      functionData?.functionMetadata?.functionType === 'VOLATILE');

  const returnTableName = functionData?.functionMetadata?.returnTableName;
  const returnTableSchema = functionData?.functionMetadata?.returnTableSchema;

  if (
    hasuraSettingsLoading ||
    isLoadingFunctionConfig ||
    isLoadingFunctionData ||
    permissionStatus === 'loading' ||
    metadataStatus === 'loading'
  ) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading function permissions...</Spinner>
      </div>
    );
  }

  if (permissionError) {
    throw permissionError;
  }

  if (metadataError) {
    throw metadataError;
  }

  const metadataRoles = new Set<string>();
  if (metadata?.tables) {
    for (const table of metadata.tables) {
      const permissionTypes = [
        'insert_permissions',
        'update_permissions',
        'select_permissions',
        'delete_permissions',
      ] as const;

      for (const permType of permissionTypes) {
        const perms = table[permType];
        if (perms) {
          for (const perm of perms) {
            if (perm.role && perm.role !== 'admin') {
              metadataRoles.add(perm.role);
            }
          }
        }
      }
    }
  }

  const allRoles = Array.from(metadataRoles).sort((a, b) => {
    if (a === 'public') {
      return -1;
    }
    if (b === 'public') {
      return 1;
    }
    return a.localeCompare(b);
  });

  const returnTableMetadata = metadata?.tables?.find(
    ({ table: currentTable }) =>
      currentTable.name === returnTableName &&
      currentTable.schema === returnTableSchema,
  );

  const roleHasSelectPermission = (role: string): boolean => {
    if (!returnTableMetadata) {
      return false;
    }

    return (
      returnTableMetadata.select_permissions?.some(
        (perm) => perm.role === role,
      ) ?? false
    );
  };

  const availableRoles = allRoles;

  const hasFunctionPermission = (role: string) => {
    return permissions.some((perm) => perm.role === role);
  };

  const isReadOnly =
    disabled || (inferFunctionPermissions && !isMutationFunction);

  const permissionRows: RolePermissionRow[] = [
    {
      role: 'admin',
      access: 'allowed',
      hasPermission: true,
      interactive: false,
    },
    ...availableRoles.map((currentRole): RolePermissionRow => {
      const access = getFunctionPermissionState({
        inferFunctionPermissions,
        isMutationFunction,
        hasSelectPermission: roleHasSelectPermission(currentRole),
        hasFunctionPermission: hasFunctionPermission(currentRole),
      });

      const stateDescription = {
        allowed: 'allowed (has SELECT permission)',
        partial: 'partially allowed (missing SELECT permission on table)',
        'not-allowed': 'not allowed',
      }[access];

      return {
        role: currentRole,
        access,
        hasPermission: hasFunctionPermission(currentRole),
        interactive: !isReadOnly,
        confirmDescription: (
          <>
            This function is <strong>{stateDescription}</strong> for role:{' '}
            <strong>{currentRole}</strong>
          </>
        ),
      };
    }),
  ];

  const handleTogglePermission = async (
    role: string,
    nextHasPermission: boolean,
  ) => {
    await execPromiseWithErrorToast(
      async () => {
        await manageFunctionPermission({
          resourceVersion,
          type: nextHasPermission
            ? 'pg_create_function_permission'
            : 'pg_drop_function_permission',
          args: {
            source: dataSource,
            function: {
              name: functionName,
              schema,
            },
            role,
          },
        });
        setExpandedRole(null);
      },
      {
        loadingMessage: `${nextHasPermission ? 'Granting' : 'Removing'} permission...`,
        successMessage: nextHasPermission
          ? `Permission for role "${role}" has been granted.`
          : `Permission for role "${role}" has been removed.`,
        errorMessage: 'An error occurred while updating permission.',
      },
    );
  };

  return (
    <div className="box flex flex-auto flex-col content-between overflow-hidden border-t bg-background">
      <div className="flex-auto overflow-hidden">
        <div className="box grid h-full grid-flow-row content-start gap-6 overflow-y-auto border-b p-6">
          <div className="grid grid-flow-row gap-2">
            <h2 className="font-bold">Roles & Permissions overview</h2>
            <p>
              Click on a permission cell to toggle function permissions for a
              role.
            </p>
          </div>

          <div className="box grid grid-flow-row gap-4 border-b pb-4">
            <div className="max-w-prose space-y-2 text-sm+">
              <FunctionPermissionsDescription
                schema={schema}
                dataSource={dataSource}
                returnTableSchema={returnTableSchema}
                returnTableName={returnTableName}
                inferFunctionPermissions={inferFunctionPermissions}
                isMutationFunction={isMutationFunction}
              />
            </div>
          </div>

          <PermissionsLegend />

          <RolePermissionsGrid
            rows={permissionRows}
            expandedRole={expandedRole}
            onExpandedRoleChange={setExpandedRole}
            onToggle={handleTogglePermission}
            isMutating={isMutating}
          />

          <Alert className="border-none bg-primary/10 text-left">
            <AlertDescription className="space-y-2 text-sm+">
              <p>
                Please go to the{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={closeDrawerWithDirtyGuard}
                >
                  Settings page
                </NavLink>{' '}
                page to add and delete roles.
              </p>
              <p>
                To configure infer function permissions, go to{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={closeDrawerWithDirtyGuard}
                >
                  Hasura Settings
                </NavLink>
                .
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

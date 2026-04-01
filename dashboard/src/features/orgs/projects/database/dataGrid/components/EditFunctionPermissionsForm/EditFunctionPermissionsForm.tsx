import NavLink from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { Spinner } from '@/components/ui/v3/spinner';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { FunctionPermissionsDescription } from '@/features/orgs/projects/database/dataGrid/components/EditFunctionPermissionsForm/FunctionPermissionsDescription';
import { PermissionsLegend } from '@/features/orgs/projects/database/dataGrid/components/PermissionsLegend';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionPermissionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPermissionQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useManageFunctionPermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManageFunctionPermissionMutation';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { useGetHasuraSettingsQuery } from '@/utils/__generated__/graphql';
import { triggerToast } from '@/utils/toast';
import type { PermissionState } from './getPermissionState';
import { getPermissionState } from './getPermissionState';

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

  // The generated FunctionConfiguration type doesn't include `response` or
  // `exposed_as`, but Hasura may return them at runtime.
  const runtimeConfig = functionConfig?.configuration as
    | {
        response?: { table?: { name?: string; schema?: string } };
        exposed_as?: 'mutation' | 'query';
      }
    | undefined;

  const responseTable = runtimeConfig?.response?.table;

  const exposedAs = runtimeConfig?.exposed_as;
  const isMutationFunction =
    exposedAs === 'mutation' ||
    (exposedAs == null &&
      functionData?.functionMetadata?.functionType === 'VOLATILE');

  const returnTableName =
    functionData?.functionMetadata?.returnTableName ||
    responseTable?.name ||
    functionData?.functionMetadata?.returnTypeName ||
    null;
  const returnTableSchema =
    functionData?.functionMetadata?.returnTableSchema ||
    responseTable?.schema ||
    functionData?.functionMetadata?.returnTypeSchema ||
    null;

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

  const renderPermissionIcon = (state: PermissionState) => {
    switch (state) {
      case 'allowed':
        return <FullPermissionIcon />;
      case 'partial':
        return <PartialPermissionIcon />;
      case 'not-allowed':
        return <NoPermissionIcon />;
    }
  };

  const handleTogglePermission = async (
    role: string,
    currentlyHasPermission: boolean,
  ) => {
    try {
      await manageFunctionPermission({
        resourceVersion,
        type: currentlyHasPermission
          ? 'pg_drop_function_permission'
          : 'pg_create_function_permission',
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

      triggerToast(
        currentlyHasPermission
          ? `Permission for role "${role}" has been removed.`
          : `Permission for role "${role}" has been granted.`,
      );
    } catch (error) {
      console.error('Failed to toggle permission:', error);
      triggerToast(
        error instanceof Error
          ? error.message
          : 'An error occurred while updating permission.',
      );
    }
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

          <div>
            <div className="grid grid-cols-2 items-center">
              <span className="p-2 text-muted-foreground text-sm">Role</span>
              <span className="p-2 text-center text-muted-foreground text-sm">
                Permission
              </span>
            </div>

            <div className="rounded-sm border">
              <div className="grid grid-cols-2 items-center border-b">
                <span className="truncate border-r p-2 text-sm">admin</span>
                <span className="inline-grid items-center justify-center text-center">
                  <FullPermissionIcon />
                </span>
              </div>

              {availableRoles.map((currentRole, index) => {
                const permState = getPermissionState({
                  inferFunctionPermissions,
                  isMutationFunction,
                  hasSelectPermission: roleHasSelectPermission(currentRole),
                  hasFunctionPermission: hasFunctionPermission(currentRole),
                });
                const hasFuncPerm = hasFunctionPermission(currentRole);
                const isExpanded = expandedRole === currentRole;
                const isLast = index === availableRoles.length - 1;

                const stateDescription = {
                  allowed: 'allowed (has SELECT permission)',
                  partial:
                    'partially allowed (missing SELECT permission on table)',
                  'not-allowed': 'not allowed',
                }[permState];

                return (
                  <Collapsible
                    key={currentRole}
                    open={isExpanded}
                    onOpenChange={(open) =>
                      setExpandedRole(open ? currentRole : null)
                    }
                    className={cn(!isLast && 'border-b')}
                  >
                    <div className="grid grid-cols-2 items-center">
                      <span className="truncate border-r p-2 text-sm">
                        {currentRole}
                      </span>
                      <span className="inline-grid h-full w-full items-center p-0 text-center">
                        {disabled ||
                        (inferFunctionPermissions && !isMutationFunction) ? (
                          <span className="inline-grid items-center justify-center">
                            {renderPermissionIcon(permState)}
                          </span>
                        ) : (
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex h-full w-full items-center justify-center rounded-none p-2 hover:bg-muted/50"
                            >
                              {renderPermissionIcon(permState)}
                            </button>
                          </CollapsibleTrigger>
                        )}
                      </span>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-4">
                        <div className="flex flex-col gap-3">
                          <p className="text-sm">
                            This function is <strong>{stateDescription}</strong>{' '}
                            for role: <strong>{currentRole}</strong>
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setExpandedRole(null)}
                              disabled={isMutating}
                            >
                              Cancel
                            </Button>

                            <Button
                              variant={hasFuncPerm ? 'outline' : 'default'}
                              size="sm"
                              className={cn(
                                hasFuncPerm &&
                                  'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive',
                              )}
                              onClick={() =>
                                handleTogglePermission(currentRole, hasFuncPerm)
                              }
                              disabled={isMutating}
                            >
                              {isMutating ? (
                                <Spinner className="h-4 w-4" />
                              ) : hasFuncPerm ? (
                                'Delete Permissions'
                              ) : (
                                'Allow'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </div>

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

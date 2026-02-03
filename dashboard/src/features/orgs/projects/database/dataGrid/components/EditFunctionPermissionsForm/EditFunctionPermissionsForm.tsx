import { Check, TriangleAlert, X } from 'lucide-react';
import NavLink from 'next/link';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionPermissionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionPermissionQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useManageFunctionPermissionMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useManageFunctionPermissionMutation';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetHasuraSettingsQuery,
  useGetRemoteAppRolesQuery,
} from '@/utils/__generated__/graphql';
import { triggerToast } from '@/utils/toast';

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
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditFunctionPermissionsForm({
  disabled,
  schema,
  functionName,
  onCancel,
}: EditFunctionPermissionsFormProps) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data: hasuraSettingsData, loading: hasuraSettingsLoading } =
    useGetHasuraSettingsQuery({
      variables: { appId: project?.id },
      ...(!isPlatform ? { client: localMimirClient } : {}),
      skip: !project?.id,
    });

  const inferFunctionPermissions =
    hasuraSettingsData?.config?.hasura.settings?.inferFunctionPermissions;

  const { data: functionConfig, isLoading: isLoadingFunctionConfig } =
    useFunctionCustomizationQuery({
      function: {
        name: functionName,
        schema,
      },
      dataSource: 'default',
    });

  const { data: functionData, isLoading: isLoadingFunctionData } =
    useFunctionQuery(
      [`function-definition`, `default.${schema}.${functionName}`],
      {
        functionName,
        schema,
        dataSource: 'default',
        queryOptions: {
          enabled: !!schema && !!functionName,
        },
      },
    );

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const {
    data: functionPermissionData,
    status: permissionStatus,
    error: permissionError,
  } = useFunctionPermissionQuery(
    [`function-permissions`, `default.${schema}.${functionName}`],
    {
      schema,
      functionName,
      dataSource: 'default',
    },
  );

  // Fetch metadata to check table permissions
  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`default.metadata`]);

  const { org } = useCurrentOrg();
  const { closeDrawerWithDirtyGuard } = useDialog();

  // State for tracking which role's collapsible is expanded
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Mutation for managing function permissions
  const { mutateAsync: manageFunctionPermission, isPending: isMutating } =
    useManageFunctionPermissionMutation();

  // Get the referenced table from function configuration or return type
  // The function configuration may have a response.table property
  // biome-ignore lint/suspicious/noExplicitAny: Function configuration may have response property
  const responseTable = (functionConfig?.configuration as any)?.response?.table;

  // Determine the return table name and schema using fallbacks:
  // 1. Direct table reference from function metadata (returnTableName/returnTableSchema)
  // 2. Response table from function configuration
  // 3. Return type name (might match a table name)
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

  const referencedTable = returnTableName || 'the referenced table';

  if (
    hasuraSettingsLoading ||
    isLoadingFunctionConfig ||
    isLoadingFunctionData ||
    rolesLoading ||
    permissionStatus === 'loading' ||
    metadataStatus === 'loading'
  ) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading function permissions...</Spinner>
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
  }

  if (permissionError) {
    throw permissionError;
  }

  if (metadataError) {
    throw metadataError;
  }

  // Collect all roles from the system, similar to Hasura console's rolesSelector
  // This includes roles from authRoles and all table permissions in metadata
  const authRolesList =
    rolesData?.authRoles?.map(({ role: authRole }) => authRole) || [];

  // Extract all unique roles from table permissions in metadata
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

  // Combine authRoles with metadata roles, ensuring 'public' is included
  const allRoles = Array.from(
    new Set(['public', ...authRolesList, ...metadataRoles]),
  ).sort((a, b) => {
    // Keep 'public' first, then sort alphabetically
    if (a === 'public') return -1;
    if (b === 'public') return 1;
    return a.localeCompare(b);
  });

  // Find the metadata for the return table to check role permissions
  const returnTableMetadata = metadata?.tables?.find(
    ({ table: currentTable }) =>
      currentTable.name === returnTableName &&
      currentTable.schema === returnTableSchema,
  );

  // Check if a role has SELECT permission on the return table
  const roleHasSelectPermission = (role: string): boolean => {
    if (!returnTableMetadata) {
      return true; // If we can't find the table, assume SELECT is allowed
    }

    return (
      returnTableMetadata.select_permissions?.some(
        (perm) => perm.role === role,
      ) ?? false
    );
  };

  // Show all roles (like Hasura console), not filtered by SELECT permission
  // The permission state icons will indicate whether SELECT permission exists
  const availableRoles = allRoles;

  // Get permissions and resourceVersion from the custom hook
  const { permissions, resourceVersion } = functionPermissionData || {
    permissions: [],
    resourceVersion: 0,
  };

  // Check if the role is in the function's permissions array
  const hasFunctionPermission = (role: string) => {
    return permissions.some((perm) => perm.role === role);
  };

  // Determine the permission state for a role
  type PermissionState = 'allowed' | 'partial' | 'not-allowed';
  const getPermissionState = (role: string): PermissionState => {
    const hasSelect = roleHasSelectPermission(role);
    const hasFuncPerm = hasFunctionPermission(role);

    if (hasFuncPerm && hasSelect) {
      return 'allowed';
    }
    if (hasFuncPerm && !hasSelect) {
      return 'partial';
    }
    return 'not-allowed';
  };

  // Render the appropriate icon for a permission state
  const renderPermissionIcon = (state: PermissionState) => {
    switch (state) {
      case 'allowed':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <TriangleAlert className="h-4 w-4 text-yellow-600" />;
      case 'not-allowed':
        return <X className="h-4 w-4 text-red-600" />;
    }
  };

  const handleTogglePermission = async (
    role: string,
    currentlyHasPermission: boolean,
  ) => {
    try {
      await manageFunctionPermission({
        resourceVersion,
        type: currentlyHasPermission ? 'drop' : 'create',
        args: {
          source: 'default',
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

  const description = (
    <>
      Permissions will be inherited from the SELECT permissions of the
      referenced table ({referencedTable}) by default.
      {inferFunctionPermissions === false ? (
        <>
          <br />
          <br />
          The function will be exposed to the role if SELECT permissions are
          enabled and function permissions are enabled for the role.
        </>
      ) : (
        <>
          <br />
          <br />
          Function will be exposed automatically if there are SELECT permissions
          for the role. To expose query functions to roles explicitly, set{' '}
          <InlineCode className="max-w-none">
            HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS=false
          </InlineCode>{' '}
          in{' '}
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
            className="text-primary underline-offset-4 hover:underline"
            onClick={closeDrawerWithDirtyGuard}
          >
            Hasura Settings
          </NavLink>
          .
        </>
      )}
    </>
  );

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
            <p className="text-sm">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-green-600" />
              <span>Allowed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <TriangleAlert className="h-4 w-4 text-yellow-600" />
              <span>Partial (no SELECT)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <X className="h-4 w-4 text-red-600" />
              <span>Not allowed</span>
            </span>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Permission</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">admin</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  </TableCell>
                </TableRow>

                {availableRoles.map((currentRole) => {
                  const permState = getPermissionState(currentRole);
                  const hasFuncPerm = hasFunctionPermission(currentRole);
                  const isExpanded = expandedRole === currentRole;

                  const stateDescription = {
                    allowed: 'allowed (has SELECT permission)',
                    partial:
                      'partially allowed (missing SELECT permission on table)',
                    'not-allowed': 'not allowed',
                  }[permState];

                  return (
                    <Collapsible
                      key={currentRole}
                      asChild
                      open={isExpanded}
                      onOpenChange={(open) =>
                        setExpandedRole(open ? currentRole : null)
                      }
                    >
                      <>
                        <TableRow>
                          <TableCell className="font-medium">
                            {currentRole}
                          </TableCell>
                          <TableCell className="text-center">
                            {disabled ? (
                              <div className="flex items-center justify-center">
                                {renderPermissionIcon(permState)}
                              </div>
                            ) : (
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-full w-full items-center justify-center rounded p-2 hover:bg-muted/50"
                                >
                                  {renderPermissionIcon(permState)}
                                </button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={2} className="p-4">
                              <div className="flex flex-col gap-3">
                                <p className="text-sm">
                                  This function is{' '}
                                  <strong>{stateDescription}</strong> for role:{' '}
                                  <strong>{currentRole}</strong>
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
                                    variant={
                                      hasFuncPerm ? 'destructive' : 'default'
                                    }
                                    size="sm"
                                    onClick={() =>
                                      handleTogglePermission(
                                        currentRole,
                                        hasFuncPerm,
                                      )
                                    }
                                    disabled={isMutating}
                                  >
                                    {isMutating ? (
                                      <Spinner className="h-4 w-4" />
                                    ) : hasFuncPerm ? (
                                      'Disallow'
                                    ) : (
                                      'Allow'
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                Please go to the{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={closeDrawerWithDirtyGuard}
                >
                  Roles and Permissions
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
